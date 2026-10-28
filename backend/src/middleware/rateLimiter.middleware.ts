import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Standard API rate limiter: 150 requests per minute
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.ENABLE_RATE_LIMITING ? 150 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again in one minute.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Strict authentication limiter: 10 attempts per 15 minutes (credential stuffing prevention)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.ENABLE_RATE_LIMITING ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Emergency intake limiter: 10 emergency case creations per 5 minutes per IP
 */
export const emergencyIntakeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: env.ENABLE_RATE_LIMITING ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Emergency creation rate limit reached. If this is a life-threatening crisis, call emergency services directly.',
    code: 'EMERGENCY_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * High-frequency GPS telemetry limiter: 120 updates per minute (supports 2Hz reporting)
 */
export const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.ENABLE_RATE_LIMITING ? 120 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'GPS telemetry rate limit exceeded (maximum 2Hz reporting allowed).',
    code: 'TELEMETRY_RATE_LIMIT_EXCEEDED',
  },
});
