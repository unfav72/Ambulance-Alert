import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env from backend directory or root
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/ambulance_db?schema=public'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters in production').default('super-secret-production-grade-emergency-jwt-key-2026-secure'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Routing Service (OSRM demo endpoint or private enterprise OSRM/OpenRouteService)
  OSRM_ROUTING_URL: z.string().url().default('https://router.project-osrm.org'),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),
  ADMIN_SETUP_TOKEN: z.string().default('emergency-admin-initial-setup-token-secure-2026'),
  // Brevo Transactional Email Service
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z
    .string()
    .transform((val) => {
      const match = val.match(/<([^>]+)>/);
      return match ? match[1].trim() : val.trim();
    })
    .pipe(z.string().email())
    .default('alerts@ambulance-ops.com'),
  BREVO_SENDER_NAME: z.string().default('AmbulanceOps Emergency Dispatch'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
