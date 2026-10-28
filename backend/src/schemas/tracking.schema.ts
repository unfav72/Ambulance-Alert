import { z } from 'zod';

export const locationUpdateSchema = z.object({
  body: z.object({
    ambulanceId: z.string().uuid(),
    trackingSessionId: z.string().uuid().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().positive().max(250, 'GPS accuracy exceeds operational threshold (max 250m)'),
    speed: z.number().min(0).max(250).optional(), // km/h
    heading: z.number().min(0).max(360).optional(),
    deviceTimestamp: z
      .string()
      .datetime({ offset: true })
      .refine(
        (ts) => {
          const time = new Date(ts).getTime();
          const now = Date.now();
          // Reject timestamps older than 2 minutes or more than 15 seconds in the future
          const isNotStale = now - time <= 120 * 1000;
          const isNotFuture = time - now <= 15 * 1000;
          return isNotStale && isNotFuture;
        },
        { message: 'GPS timestamp rejected: Observation is either stale (>120s) or in future (>15s)' }
      ),
  }),
});

export const startTrackingSessionSchema = z.object({
  body: z.object({
    ambulanceId: z.string().uuid(),
    deviceId: z.string().min(5).max(100),
  }),
});

export const endTrackingSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid(),
  }),
});
