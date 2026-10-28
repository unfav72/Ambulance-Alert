import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error(`Unhandled request error [${req.method} ${req.url}]`, {
    error: err.message,
    statusCode,
    stack: isProduction ? undefined : err.stack,
  });

  let errorMessage = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_ERROR';

  if (err.message?.includes("Can't reach database server") || err.code === 'P1001') {
    errorMessage = 'Database Unreachable: PostgreSQL server is not running at the configured DATABASE_URL. Ensure local PostgreSQL is running on port 5432, or set DATABASE_URL in backend/.env to a cloud PostgreSQL database (e.g. Supabase, Neon, or AWS RDS).';
    errorCode = 'DATABASE_CONNECTION_ERROR';
  }

  res.status(statusCode).json({
    error: errorMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
