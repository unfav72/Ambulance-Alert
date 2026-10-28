import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { socketService } from './services/socket.service.js';
import { checkDatabaseConnection, prisma } from './db/prisma.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.IO service on the HTTP server
  socketService.initialize(server);

  // Check database connectivity
  const dbCheck = await checkDatabaseConnection();
  if (!dbCheck.ok) {
    logger.warn('Initial database connectivity check failed. Ensure PostgreSQL server is running.', {
      error: dbCheck.error,
    });
  } else {
    logger.info('Connected to PostgreSQL database successfully');
  }

  server.listen(env.PORT, () => {
    logger.info(`Emergency Coordination Backend running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`CORS allowed origin: ${env.CORS_ORIGIN}`);
    logger.info(`Routing service endpoint: ${env.OSRM_ROUTING_URL}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    });

    // Force shutdown after 10 seconds if lingering
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrapping failure', { error: err.message, stack: err.stack });
  process.exit(1);
});
