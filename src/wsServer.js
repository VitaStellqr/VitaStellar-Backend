import http from 'http';
import { Server } from 'socket.io';
import redisAdapter from 'socket.io-redis';
import jwt from 'jsonwebtoken';
import config from '../config';

let io;

export function initWebSocket(server) {
  io = new Server(server, {
    path: '/ws',
    transports: ['websocket', 'polling'],
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Redis adapter for scalability
  if (process.env.REDIS_URL) {
    io.adapter(redisAdapter({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }));
  }

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const user = jwt.verify(token, config.jwtSecret);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join userId room
    if (socket.user && socket.user._id) {
      socket.join(`user:${socket.user._id}`);
    }
    // Join resourceId room if provided
    const { resourceId } = socket.handshake.query;
    if (resourceId) {
      socket.join(`resource:${resourceId}`);
    }

    // Handle ping/pong
    socket.on('ping', () => socket.emit('pong'));

    // Handle disconnects
    socket.on('disconnect', (reason) => {
      // Optionally log disconnects
    });
  });
}

// Broadcast helpers
export function notifyUser(userId, event, data) {
  io?.to(`user:${userId}`).emit(event, data);
}
export function notifyResource(resourceId, event, data) {
  io?.to(`resource:${resourceId}`).emit(event, data);
}
