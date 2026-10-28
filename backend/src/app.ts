import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import apiRouter from './routes/api.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Production security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Handled by frontend or reverse proxy
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS configuration with explicit origins and credentials
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Compression and body parsing
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Structured HTTP request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // 5. Global rate limiter
  app.use(generalLimiter);

  // 6. Root health probe
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 7. Mount Version 1 API routes
  app.use('/api/v1', apiRouter);

  // 8. 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    });
  });

  // 9. Central error handling middleware
  app.use(errorHandler);

  return app;
}
