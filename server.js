/* eslint-disable */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Authorization is now handled dynamically via Calendar Service API
const CALENDAR_API_URL = process.env.CALENDAR_API_URL || "http://localhost:8080";

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket.IO Logic
  const userNames = new Map(); // Store socket.id -> userName mapping
  const socketRooms = new Map(); // Store socket.id -> roomId mapping (set only after authorize succeeds)

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", async (roomId, userId, token) => {
      // Chain of Responsibility Handler 1: Basic validation
      if (!userId || !token) {
        socket.emit("error", "Invalid user details");
        return;
      }

      // Chain of Responsibility Handler 2: Calendar Service Authorization.
      // The token is the caller's real NestWorks session JWT, forwarded as-is
      // so the backend's normal Spring Security auth resolves the real user --
      // no separate meets-specific auth scheme, no userName trusted from the client.
      let userName;
      try {
        const response = await fetch(
          `${CALENDAR_API_URL}/api/v1/academic/meets/authorize?roomId=${encodeURIComponent(roomId)}`,
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

      console.log(`User ${userName} (${userId}) joined room ${roomId}`);

      // Store userName + room for this socket -- this is what marks the socket
      // as authorized; every signaling handler below checks it first.
      userNames.set(socket.id, userName);
      socketRooms.set(socket.id, roomId);

      socket.join(roomId);
      // Broadcast to others in the room
      socket.to(roomId).emit("user-connected", userId, userName);

      socket.on("disconnect", () => {
        console.log(`User ${userName} disconnected`);
        socket.to(roomId).emit("user-disconnected", userId);
        // Clean up mappings
        userNames.delete(socket.id);
        socketRooms.delete(socket.id);
      });
    });

    // A socket may only relay signaling once it has completed join-room
    // authorization, and only to a peer sitting in that same room -- otherwise
    // any connected socket could forge an SDP offer/answer at a guessed or
    // previously-seen socket id and hijack another participant's call.
    function authorizedPeerInSameRoom(socket, targetSocketId) {
      const room = socketRooms.get(socket.id);
      if (!room) return false;
      return socketRooms.get(targetSocketId) === room;
    }

    // Signaling - include userName in events
    socket.on("offer", (data) => {
      // data: { offer, to }
      if (!authorizedPeerInSameRoom(socket, data.to)) return;
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("offer", {
        offer: data.offer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("answer", (data) => {
      // data: { answer, to }
      if (!authorizedPeerInSameRoom(socket, data.to)) return;
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("answer", {
        answer: data.answer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("ice-candidate", (data) => {
      // data: { candidate, to }
      if (!authorizedPeerInSameRoom(socket, data.to)) return;
      socket
        .to(data.to)
        .emit("ice-candidate", { candidate: data.candidate, from: socket.id });
    });

    // Peer state changes (mute/video toggle)
    socket.on("peer-state-changed", (data) => {
      // data: { userId, muted, videoOff } -- roomId is the socket's own
      // authorized room, never the client-supplied one, so a caller can't
      // spoof state into a room it never joined.
      const room = socketRooms.get(socket.id);
      if (!room) return;
      socket.to(room).emit("peer-state-changed", {
        userId: data.userId,
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

  // Next.js handler
  server.all(/.*/, (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  // Listen on all network interfaces
  httpServer.listen(PORT, "0.0.0.0", (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);

    // Log LAN IP addresses
    const { networkInterfaces } = require("os");
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          console.log(`> Local Network: http://${net.address}:${PORT}`);
        }
      }
    }
  });
});
