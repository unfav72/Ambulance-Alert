import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { AuthService, JwtPayload } from './auth.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

class SocketService {
  private io: Server | null = null;

  public initialize(httpServer: HttpServer) {
    const socketCorsOrigin = env.CORS_ORIGIN === '*'
      ? true
      : (env.CORS_ORIGIN.includes(',') ? env.CORS_ORIGIN.split(',').map((o) => o.trim()) : env.CORS_ORIGIN);

    this.io = new Server(httpServer, {
      cors: {
        origin: socketCorsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    // Authentication middleware for socket connections
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        // Allow unauthenticated guest connections for public telemetry and case tracking
        socket.data.user = undefined;
        return next();
      }

      try {
        const payload = AuthService.verifyToken(token);
        socket.data.user = payload;
        next();
      } catch (err: any) {
        // If token is invalid or expired, gracefully connect as guest
        socket.data.user = undefined;
        next();
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.data.user;
      logger.info('Socket client connected', { socketId: socket.id, user: user?.email || 'Anonymous Public Case Tracker' });

      // Automatically join role-specific rooms
      if (user) {
        if (user.role === 'DISPATCHER' || user.role === 'SYSTEM_ADMIN') {
          socket.join('dispatchers');
        }
        if (user.role === 'HOSPITAL_STAFF' && user.organizationId) {
          socket.join(`hospital:${user.organizationId}`);
        }
      }

      // Room subscription handlers
      socket.on('subscribe:case', (caseId: string) => {
        socket.join(`case:${caseId}`);
        logger.debug(`Socket ${socket.id} subscribed to case:${caseId}`);
      });

      socket.on('unsubscribe:case', (caseId: string) => {
        socket.leave(`case:${caseId}`);
      });

      socket.on('subscribe:ambulance', (ambulanceId: string) => {
        // Only crew or dispatchers can subscribe to vehicle telemetry
        if (user && (user.role === 'DISPATCHER' || user.role === 'SYSTEM_ADMIN' || user.role === 'AMBULANCE_CREW')) {
          socket.join(`crew:${ambulanceId}`);
        }
      });

      socket.on('disconnect', (reason) => {
        logger.debug('Socket client disconnected', { socketId: socket.id, reason });
      });
    });

    logger.info('Real-time Socket.IO service initialized successfully');
  }

  public getIo(): Server {
    if (!this.io) {
      throw new Error('SocketService has not been initialized with HTTP server');
    }
    return this.io;
  }

  // Broadcasters for operational events
  public broadcastToDispatchers(event: string, data: any) {
    if (this.io) {
      this.io.to('dispatchers').emit(event, data);
    }
  }

  public broadcastToCase(caseId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`case:${caseId}`).emit(event, data);
      // Also notify dispatchers of any case changes
      this.io.to('dispatchers').emit(event, data);
    }
  }

  public broadcastToHospital(hospitalId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`hospital:${hospitalId}`).emit(event, data);
    }
  }

  public broadcastGpsUpdate(ambulanceId: string, caseId: string | null, data: any) {
    if (this.io) {
      this.io.to('dispatchers').emit('tracking:update', data);
      this.io.to(`crew:${ambulanceId}`).emit('tracking:update', data);
      if (caseId) {
        this.io.to(`case:${caseId}`).emit('tracking:update', data);
      }
    }
  }
}

export const socketService = new SocketService();
