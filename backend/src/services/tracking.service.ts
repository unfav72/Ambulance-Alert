import { prisma } from '../db/prisma.js';
import { socketService } from './socket.service.js';
import { auditService } from './audit.service.js';
import { logger } from '../utils/logger.js';
import {
  calculateHaversineDistance,
  calculateCalculatedSpeed,
  isSpeedPlausible,
  isValidCoordinate,
} from '../utils/geo.js';

export interface LocationTelemetryPayload {
  ambulanceId: string;
  trackingSessionId?: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speed?: number; // Reported speed from device
  heading?: number;
  deviceTimestamp: string;
}

export class TrackingService {
  /**
   * Processes, validates, persists, and broadcasts real-time GPS telemetry from authorized crew device
   */
  public static async processLocationUpdate(
    userId: string,
    payload: LocationTelemetryPayload
  ) {
    // 1. Verify that user has an active shift assignment on this ambulance
    const shift = await prisma.crewAssignment.findFirst({
      where: {
        ambulanceId: payload.ambulanceId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!shift) {
      logger.security('Unauthorized GPS telemetry update attempt', {
        userId,
        ambulanceId: payload.ambulanceId,
      });
      throw new Error('Access denied: You do not have an active shift on this ambulance.');
    }

    // 2. Validate geodetic coordinates
    if (!isValidCoordinate(payload.latitude, payload.longitude)) {
      throw new Error(`Invalid coordinate bounds: [${payload.latitude}, ${payload.longitude}]`);
    }

    // 3. Fetch current vehicle state for sanity delta check
    const ambulance = await prisma.ambulance.findUnique({
      where: { id: payload.ambulanceId },
    });

    if (!ambulance) {
      throw new Error(`Ambulance ${payload.ambulanceId} not found`);
    }

    const observationTime = new Date(payload.deviceTimestamp);
    let calculatedSpeedKmH = payload.speed ?? 0;
    let isTelemetrySuspicious = false;

    // 4. Movement physics check against last-known observation
    if (ambulance.currentLatitude && ambulance.currentLongitude && ambulance.lastGpsUpdate) {
      const prevTime = new Date(ambulance.lastGpsUpdate);
      const computedSpeed = calculateCalculatedSpeed(
        ambulance.currentLatitude,
        ambulance.currentLongitude,
        prevTime,
        payload.latitude,
        payload.longitude,
        observationTime
      );

      calculatedSpeedKmH = computedSpeed;

      // Teleportation / spoofing check
      if (!isSpeedPlausible(computedSpeed, 180)) {
        isTelemetrySuspicious = true;
        logger.warn('Suspicious GPS teleportation detected', {
          ambulanceId: payload.ambulanceId,
          computedSpeedKmH: computedSpeed,
          prevPos: [ambulance.currentLatitude, ambulance.currentLongitude],
          newPos: [payload.latitude, payload.longitude],
        });
      }
    }

    // 5. Ensure tracking session exists
    let sessionId = payload.trackingSessionId;
    if (!sessionId) {
      const activeSession = await prisma.trackingSession.findFirst({
        where: { ambulanceId: payload.ambulanceId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
      });

      if (activeSession) {
        sessionId = activeSession.id;
      } else {
        const newSession = await prisma.trackingSession.create({
          data: {
            ambulanceId: payload.ambulanceId,
            crewAssignmentId: shift.id,
            deviceId: 'BROWSER_PWA_GEOLOCATION',
            status: 'ACTIVE',
          },
        });
        sessionId = newSession.id;
      }
    }

    // 6. Persist location history entry and update current ambulance position
    const [locationRecord] = await prisma.$transaction([
      prisma.locationHistory.create({
        data: {
          trackingSessionId: sessionId,
          ambulanceId: payload.ambulanceId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyMeters: payload.accuracyMeters,
          speed: calculatedSpeedKmH,
          heading: payload.heading ?? null,
          deviceTimestamp: observationTime,
        },
      }),
      prisma.ambulance.update({
        where: { id: payload.ambulanceId },
        data: {
          currentLatitude: payload.latitude,
          currentLongitude: payload.longitude,
          lastGpsUpdate: observationTime,
          isTrackingActive: true,
        },
      }),
    ]);

    // 7. Check if this ambulance is currently assigned to an active emergency case
    const activeAllocation = await prisma.caseAllocation.findFirst({
      where: {
        ambulanceId: payload.ambulanceId,
        status: { in: ['ASSIGNED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING'] },
      },
      include: { emergencyCase: true },
    });

    const activeCaseId = activeAllocation?.caseId ?? null;

    // 8. Broadcast telemetry update
    const telemetryEvent = {
      ambulanceId: payload.ambulanceId,
      callSign: ambulance.callSign,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: payload.accuracyMeters,
      speedKmH: calculatedSpeedKmH,
      heading: payload.heading ?? null,
      deviceTimestamp: payload.deviceTimestamp,
      serverReceivedAt: locationRecord.serverReceivedAt.toISOString(),
      caseId: activeCaseId,
      isSuspicious: isTelemetrySuspicious,
    };

    socketService.broadcastGpsUpdate(payload.ambulanceId, activeCaseId, telemetryEvent);

    return {
      success: true,
      locationId: locationRecord.id,
      sessionId,
      isSuspicious: isTelemetrySuspicious,
      activeCaseId,
    };
  }

  /**
   * Retrieves paginated location history for an ambulance
   */
  public static async getLocationHistory(ambulanceId: string, limit = 100) {
    return prisma.locationHistory.findMany({
      where: { ambulanceId },
      orderBy: { deviceTimestamp: 'desc' },
      take: Math.min(500, limit),
    });
  }
}
