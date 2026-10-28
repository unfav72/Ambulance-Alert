import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateBearing,
  isValidCoordinate,
  calculateCalculatedSpeed,
  isSpeedPlausible,
} from '../src/utils/geo.js';
import { locationUpdateSchema } from '../src/schemas/tracking.schema.js';

describe('GPS Telemetry and Geodetic Validation Tests', () => {
  it('should accurately calculate Haversine distance between two points', () => {
    // New Delhi (28.6139, 77.2090) to AIIMS New Delhi (28.5672, 77.2100)
    const distanceMeters = calculateHaversineDistance(28.6139, 77.2090, 28.5672, 77.2100);
    expect(distanceMeters).toBeGreaterThan(5000);
    expect(distanceMeters).toBeLessThan(5500);
  });

  it('should compute valid bearing between 0 and 360 degrees', () => {
    const bearing = calculateBearing(13.0827, 80.2707, 13.0850, 80.2707); // Heading Due North
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThanOrEqual(360);
  });

  it('should strictly reject invalid latitude and longitude bounds', () => {
    expect(isValidCoordinate(91.0, 50.0)).toBe(false);
    expect(isValidCoordinate(-91.0, 50.0)).toBe(false);
    expect(isValidCoordinate(50.0, 181.0)).toBe(false);
    expect(isValidCoordinate(50.0, -181.0)).toBe(false);
    expect(isValidCoordinate(13.0827, 80.2707)).toBe(true);
  });

  it('should calculate realistic speed and flag physically implausible vehicle velocity', () => {
    const time1 = new Date('2026-10-28T10:00:00Z');
    const time2 = new Date('2026-10-28T10:01:00Z'); // 60 seconds later

    // 1 km in 60s = 60 km/h (Normal emergency response speed)
    const speedNormal = calculateCalculatedSpeed(13.0827, 80.2707, time1, 13.0917, 80.2707, time2);
    expect(isSpeedPlausible(speedNormal, 180)).toBe(true);

    // 50 km in 60s = 3000 km/h (Physically impossible / teleportation GPS spoofing)
    const speedTeleport = calculateCalculatedSpeed(13.0827, 80.2707, time1, 13.5327, 80.2707, time2);
    expect(isSpeedPlausible(speedTeleport, 180)).toBe(false);
  });

  it('should validate tracking schema: reject stale timestamp and poor accuracy', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const nowIso = new Date().toISOString();

    // Valid payload
    const validResult = locationUpdateSchema.safeParse({
      body: {
        ambulanceId: validUuid,
        latitude: 13.0827,
        longitude: 80.2707,
        accuracyMeters: 12.5,
        deviceTimestamp: nowIso,
      },
    });
    expect(validResult.success).toBe(true);

    // Rejected: Excessive inaccuracy (> 250m)
    const inaccurateResult = locationUpdateSchema.safeParse({
      body: {
        ambulanceId: validUuid,
        latitude: 13.0827,
        longitude: 80.2707,
        accuracyMeters: 650.0,
        deviceTimestamp: nowIso,
      },
    });
    expect(inaccurateResult.success).toBe(false);

    // Rejected: Stale timestamp (5 minutes old)
    const staleTime = new Date(Date.now() - 300 * 1000).toISOString();
    const staleResult = locationUpdateSchema.safeParse({
      body: {
        ambulanceId: validUuid,
        latitude: 13.0827,
        longitude: 80.2707,
        accuracyMeters: 10.0,
        deviceTimestamp: staleTime,
      },
    });
    expect(staleResult.success).toBe(false);
  });
});
