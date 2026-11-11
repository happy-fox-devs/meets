/* eslint-disable */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const { createTicketStore, positiveMsFromEnv, DEFAULT_TTL_MS, DEFAULT_GRACE_MS } = require("./rejoin-tickets");
const { attachSignaling } = require("./signaling");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Authorization is now handled dynamically via Calendar Service API
const CALENDAR_API_URL = process.env.CALENDAR_API_URL || "http://localhost:8080";

// Full-mesh WebRTC: cost grows O(n^2) per room, so cap membership.
const MAX_ROOM_SIZE = parseInt(process.env.MAX_ROOM_SIZE || "8", 10);

// The access token that lets someone into a room lives 1h, shorter than a call can run. See rejoin-tickets.js.
// REJOIN_TICKET_TTL_MS: absolute maximum life of a ticket (default 3h). REJOIN_GRACE_MS: how long a ticket survives once the socket
// holding it is gone (default 10 min). Both must be a finite number > 0, otherwise the default applies.
const rejoinTickets = createTicketStore({
  ttlMs: positiveMsFromEnv(process.env.REJOIN_TICKET_TTL_MS, DEFAULT_TTL_MS),
  graceMs: positiveMsFromEnv(process.env.REJOIN_GRACE_MS, DEFAULT_GRACE_MS),
});

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });

  // Dedicated health-check, registered before the Next.js catch-all below so
  // it never falls through to page routing.
  server.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Socket.IO logic (signaling, authorization, rejoin tickets) lives in signaling.js.
  attachSignaling(io, { calendarApiUrl: CALENDAR_API_URL, maxRoomSize: MAX_ROOM_SIZE, tickets: rejoinTickets });

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

  // Without this, every live call breaks abruptly on deploy: the process is
  // killed outright instead of letting participants know the server is going
  // away and closing sockets cleanly.
  const shutdown = (signal) => {
    console.log(`> ${signal} received, shutting down gracefully`);
    io.emit("error", "Server is restarting, please rejoin in a moment.");
    io.close();
    httpServer.close(() => {
      console.log("> HTTP server closed");
      process.exit(0);
    });
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
