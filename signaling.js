/* eslint-disable */
// Socket.IO signaling for the rooms. Lives apart from server.js (which also boots Next) so it can be tested with a bare Socket.IO
// server and a mock backend. See rejoin-tickets.js for how a participant gets back in after a network blip.

/**
 * @param io            a socket.io Server
 * @param calendarApiUrl base URL of the Calendar service that authorizes who may enter a room
 * @param maxRoomSize   full-mesh WebRTC costs O(n^2) per room, so membership is capped
 * @param tickets       a store from rejoin-tickets.js
 */
function attachSignaling(io, { calendarApiUrl, maxRoomSize, tickets }) {
  const userNames = new Map(); // socket.id -> userName
  const socketRooms = new Map(); // socket.id -> roomId (set only after authorization succeeds)
  const socketTickets = new Map(); // socket.id -> rejoin ticket the socket holds
  const joining = new Set(); // sockets with a join-room still being authorized
  const left = new Set(); // sockets that sent leave-room while their join-room was still being authorized

  /** Removes everything this socket holds in the room. `revoke` is for an intentional leave: the ticket is of no use afterwards. */
  function depart(socket, { revoke }) {
    const roomId = socketRooms.get(socket.id);
    const ticket = socketTickets.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("user-disconnected", socket.id);
      socket.leave(roomId);
    }
    if (ticket) {
      if (revoke) tickets.revoke(ticket);
      else tickets.release(ticket, socket.id);
    }
    userNames.delete(socket.id);
    socketRooms.delete(socket.id);
    socketTickets.delete(socket.id);
  }

  // A socket may only relay signaling once it has completed join-room authorization, and only to a peer sitting in that same room
  // -- otherwise any connected socket could forge an SDP offer/answer at a guessed or previously-seen socket id and hijack
  // another participant's call.
  function authorizedPeerInSameRoom(socket, targetSocketId) {
    const room = socketRooms.get(socket.id);
    if (!room) return false;
    return socketRooms.get(targetSocketId) === room;
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    async function joinRoom(roomId, userId, token, rejoinTicket) {
      // Chain of Responsibility Handler 1: Basic validation. The client's `userId` is only required to be present: the identity
      // other peers see is always this socket's own id, never something the client chose.
      if (typeof roomId !== "string" || !userId || (!token && !rejoinTicket)) {
        socket.emit("error", "Invalid user details");
        return;
      }

      // Chain of Responsibility Handler 2: Authorization.
      //
      // Reconnect of someone this server already admitted (the browser's socket got a new id): the ticket from their first join
      // proves it, and is only good for the room it was issued for. This is what keeps a call alive past the 1h access token, which
      // the browser still holds from the URL and which would be expired by now.
      let userName;
      let ticket;
      let staleSocketId;
      const resumed = rejoinTicket ? tickets.resume(rejoinTicket, roomId) : null;
      if (resumed) {
        userName = resumed.userName;
        ticket = rejoinTicket;
        staleSocketId = resumed.socketId;
      } else {
        // First join (or a ticket that is gone, e.g. after a restart): Calendar Service Authorization.
        // The token is the caller's real NestWorks session JWT, forwarded as-is
        // so the backend's normal Spring Security auth resolves the real user --
        // no separate meets-specific auth scheme, no userName trusted from the client.
        if (!token) {
          socket.emit("error", "Not authorized for this room");
          return;
        }
        try {
          const response = await fetch(
            `${calendarApiUrl}/api/v1/academic/meets/authorize?roomId=${encodeURIComponent(roomId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const data = await response.json();
          if (!response.ok || !data.authorized) {
            throw new Error(data.error || "Not authorized");
          }
          userName = data.userName || "Participant";
        } catch (error) {
          console.error("Authorization check failed:", error.message);
          socket.emit("error", "Not authorized for this room");
          return;
        }
        // The browser gave up (closed, or hung up with leave-room) while the backend was answering: do not admit it, and do not
        // issue it a ticket either -- there is nothing to revoke later because leave-room already ran.
        if (socket.disconnected || left.has(socket.id)) return;
      }

      // The old socket of this participant may still be hanging around (half-open transport): drop it so it neither counts
      // against the room size nor keeps receiving the call.
      if (staleSocketId && staleSocketId !== socket.id) {
        io.sockets.sockets.get(staleSocketId)?.disconnect(true);
      }

      const currentSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      if (currentSize >= maxRoomSize) {
        socket.emit("error", "This room is full");
        return;
      }

      // A fresh admission gets its own ticket; a resumed one keeps the ticket it came with.
      ticket = ticket || tickets.issue(roomId, userName, socket.id);
      tickets.bind(ticket, socket.id);

      console.log(`User ${userName} (${socket.id}) joined room ${roomId}`);

      // Store userName + room for this socket -- this is what marks the socket
      // as authorized; every signaling handler below checks it first.
      userNames.set(socket.id, userName);
      socketRooms.set(socket.id, roomId);
      socketTickets.set(socket.id, ticket);

      socket.join(roomId);
      // Only this socket gets the ticket; the browser keeps it in memory and sends it back on its next reconnect.
      socket.emit("room-session", ticket);
      // Broadcast to others in the room
      socket.to(roomId).emit("user-connected", socket.id, userName);
    }

    socket.on("join-room", async (roomId, userId, token, rejoinTicket) => {
      // One admission per socket: a repeated join-room (a buggy or hostile client) must not mint more tickets or re-announce itself.
      // A browser that reconnects has a new socket, so this never blocks a legitimate rejoin.
      if (socketRooms.has(socket.id) || joining.has(socket.id)) return;
      joining.add(socket.id);
      try {
        await joinRoom(roomId, userId, token, rejoinTicket);
      } finally {
        joining.delete(socket.id);
        left.delete(socket.id);
      }
    });

    // Hanging up on purpose: the ticket dies with the call instead of lingering as a credential. The ticket is the one this socket
    // holds server-side, nothing the client sends. `ack` lets the page wait for this before it navigates away.
    socket.on("leave-room", (ack) => {
      if (joining.has(socket.id)) left.add(socket.id);
      depart(socket, { revoke: true });
      if (typeof ack === "function") ack();
    });

    // Registered once per connection (not per join), so repeated joins can never stack listeners.
    socket.on("disconnect", () => {
      const userName = userNames.get(socket.id);
      if (userName) console.log(`User ${userName} disconnected`);
      depart(socket, { revoke: false });
    });

    // Signaling - include userName in events
    socket.on("offer", (data) => {
      // data: { offer, to }
      if (!data || !authorizedPeerInSameRoom(socket, data.to)) return;
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("offer", {
        offer: data.offer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("answer", (data) => {
      // data: { answer, to }
      if (!data || !authorizedPeerInSameRoom(socket, data.to)) return;
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("answer", {
        answer: data.answer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("ice-candidate", (data) => {
      // data: { candidate, to }
      if (!data || !authorizedPeerInSameRoom(socket, data.to)) return;
      socket
        .to(data.to)
        .emit("ice-candidate", { candidate: data.candidate, from: socket.id });
    });

    // Peer state changes (mute/video toggle)
    socket.on("peer-state-changed", (data) => {
      // data: { userId, muted, videoOff } -- roomId is the socket's own authorized room and userId is the socket's own id, never
      // the client-supplied ones, so a caller can't spoof state into a room it never joined or into another peer's tile.
      const room = socketRooms.get(socket.id);
      if (!room || !data) return;
      socket.to(room).emit("peer-state-changed", {
        userId: socket.id,
        muted: data.muted,
        videoOff: data.videoOff,
      });
    });

    // Chat
    socket.on("send-message", (_roomId, message, _userName) => {
      const room = socketRooms.get(socket.id);
      if (!room) return;
      const userName = userNames.get(socket.id) || "Participant";
      socket.to(room).emit("receive-message", {
        message,
        userName,
        time: new Date().toLocaleTimeString(),
      });
    });
  });
}

module.exports = { attachSignaling };
