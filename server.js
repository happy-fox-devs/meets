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

      // Store userName for this socket
      userNames.set(socket.id, userName);

      socket.join(roomId);
      // Broadcast to others in the room
      socket.to(roomId).emit("user-connected", userId, userName);

      socket.on("disconnect", () => {
        console.log(`User ${userName} disconnected`);
        socket.to(roomId).emit("user-disconnected", userId);
        // Clean up userName mapping
        userNames.delete(socket.id);
      });
    });

    // Signaling - include userName in events
    socket.on("offer", (data) => {
      // data: { offer, to }
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("offer", {
        offer: data.offer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("answer", (data) => {
      // data: { answer, to }
      const senderName = userNames.get(socket.id) || "Participant";
      socket.to(data.to).emit("answer", {
        answer: data.answer,
        from: socket.id,
        userName: senderName,
      });
    });

    socket.on("ice-candidate", (data) => {
      // data: { candidate, to }
      socket
        .to(data.to)
        .emit("ice-candidate", { candidate: data.candidate, from: socket.id });
    });

    // Peer state changes (mute/video toggle)
    socket.on("peer-state-changed", (data) => {
      // data: { roomId, userId, muted, videoOff }
      socket.to(data.roomId).emit("peer-state-changed", {
        userId: data.userId,
        muted: data.muted,
        videoOff: data.videoOff,
      });
    });

    // Chat
    socket.on("send-message", (roomId, message, userName) => {
      socket.to(roomId).emit("receive-message", {
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
