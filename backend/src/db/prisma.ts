import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Extend NodeJS Global interface to cache Prisma in development
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Health check to verify database connectivity
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await withDbRetry(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }, 4, 1500);
    return { ok: true };
  } catch (error: any) {
    logger.error('Database connection check failed', { message: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * Executes a database operation with exponential backoff retry for Neon serverless cold starts.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1200): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errorMsg = err?.message || '';
      const isConnectionError =
        errorMsg.includes("Can't reach database server") ||
        errorMsg.includes('P1001') ||
        errorMsg.includes('P1008') ||
        errorMsg.includes('Connection terminated') ||
        errorMsg.includes('timeout');

      if (isConnectionError && attempt < retries) {
        logger.warn(`Neon serverless database warming up (attempt ${attempt}/${retries}). Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
