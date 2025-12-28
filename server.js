const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const WHITELIST = [
  'admin',
  'user1',
  'user2',
  'alice',
  'bob'
]; // In a real app, this would be a DB

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO Logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userId, userName) => {
      if (!WHITELIST.includes(userName)) {
        socket.emit('error', 'User not whitelisted');
        return;
      }

      console.log(`User ${userName} (${userId}) joined room ${roomId}`);
      
      socket.join(roomId);
      // Broadcast to others in the room
      socket.to(roomId).emit('user-connected', userId, userName);

      socket.on('disconnect', () => {
        console.log(`User ${userName} disconnected`);
        socket.to(roomId).emit('user-disconnected', userId);
      });
    });

    // Signaling
    socket.on('offer', (data) => {
      // data: { offer, to }
      socket.to(data.to).emit('offer', { offer: data.offer, from: socket.id });
    });

    socket.on('answer', (data) => {
      // data: { answer, to }
      socket.to(data.to).emit('answer', { answer: data.answer, from: socket.id });
    });

    socket.on('ice-candidate', (data) => {
      // data: { candidate, to }
      socket.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
    });

    // Chat
    socket.on('send-message', (roomId, message, userName) => {
        socket.to(roomId).emit('receive-message', { message, userName, time: new Date().toLocaleTimeString() });
    });
  });

  // Next.js handler
  server.all(/.*/, (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  // Listen on all network interfaces
  httpServer.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    
    // Log LAN IP addresses
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`> Local Network: http://${net.address}:${PORT}`);
            }
        }
    }
  });
});
