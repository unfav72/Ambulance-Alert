import { prisma } from '../db/prisma.js';
import { routingService } from './routing.service.js';
import { socketService } from './socket.service.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { HospitalCoordinationStatus, TriagePriority } from '@prisma/client';

export interface HospitalCandidate {
  hospitalId: string;
  name: string;
  address: string;
  traumaLevel: number | null;
  distanceMeters: number;
  etaSeconds: number;
  availableBeds: number;
  icuBedsAvailable: number;
  isCapacityFresh: boolean;
  score: number;
  recommendationReason: string;
}

export class HospitalCoordinationService {
  /**
   * Concurrently discovers and ranks verified hospitals for an emergency case.
   */
  public static async discoverAndCoordinateHospitals(caseId: string): Promise<HospitalCandidate[]> {
    const emergencyCase = await prisma.emergencyCase.findUnique({
      where: { id: caseId },
    });

    if (!emergencyCase) {
      throw new Error(`Emergency case ${caseId} not found`);
    }

    // Find all verified hospitals
    const hospitals = await prisma.organization.findMany({
      where: {
        type: 'HOSPITAL',
        verified: true,
      },
      include: {
        hospitalCapacity: true,
      },
    });

    if (hospitals.length === 0) {
      logger.warn('No verified hospital facilities found in system', { caseId });
      return [];
    }

    const candidates: HospitalCandidate[] = [];

    for (const h of hospitals) {
      // Real routing calculation from pickup location to hospital facility
      const route = await routingService.getRoute(
        emergencyCase.pickupLatitude,
        emergencyCase.pickupLongitude,
        h.latitude,
        h.longitude
      );

      const cap = h.hospitalCapacity;
      const availableBeds = cap?.availableBeds ?? 0;
      const icuBedsAvailable = cap?.icuBedsAvailable ?? 0;

      // Freshness check: Capacity is considered stale if not updated in last 4 hours
      let isCapacityFresh = false;
      if (cap?.updatedAt) {
        const hoursOld = (Date.now() - new Date(cap.updatedAt).getTime()) / (1000 * 60 * 60);
        isCapacityFresh = hoursOld <= 4;
      }

      // Scoring formula:
      // Distance factor: 40 points
      const distanceScore = Math.max(5, Math.round(40 * Math.exp(-route.distanceMeters / 20000)));

      // Bed availability factor: 30 points
      let bedScore = 0;
      if (emergencyCase.triagePriority === TriagePriority.CRITICAL_P1) {
        bedScore = icuBedsAvailable > 0 ? 30 : 5;
      } else {
        bedScore = availableBeds > 5 ? 30 : availableBeds > 0 ? 15 : 0;
      }

      // Trauma capability factor: 20 points
      let traumaScore = 5;
      if (h.traumaLevel === 1) traumaScore = 20;
      else if (h.traumaLevel === 2) traumaScore = 15;
      else if (h.traumaLevel === 3) traumaScore = 10;

      // Data freshness factor: 10 points
      const freshnessScore = isCapacityFresh ? 10 : 0;

      const totalScore = distanceScore + bedScore + traumaScore + freshnessScore;
      const recommendationReason = `Score ${totalScore}: ETA ~${Math.round(route.durationSeconds / 60)}min (${(route.distanceMeters / 1000).toFixed(1)}km), Trauma Level ${h.traumaLevel ?? 'Community'}, Available Beds: ${availableBeds} (ICU: ${icuBedsAvailable})${!isCapacityFresh ? ' [Capacity data stale]' : ''}`;

      candidates.push({
        hospitalId: h.id,
        name: h.name,
        address: h.address,
        traumaLevel: h.traumaLevel,
        distanceMeters: route.distanceMeters,
        etaSeconds: route.durationSeconds,
        availableBeds,
        icuBedsAvailable,
        isCapacityFresh,
        score: totalScore,
        recommendationReason,
      });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    // Persist coordination records for the top candidates (up to 3)
    const topCandidates = candidates.slice(0, 3);

    for (const c of topCandidates) {
      await prisma.hospitalCoordination.upsert({
        where: {
          caseId_hospitalId: {
            caseId,
            hospitalId: c.hospitalId,
          },
        },
        create: {
          caseId,
          hospitalId: c.hospitalId,
          status: HospitalCoordinationStatus.RECOMMENDED,
          distanceMeters: c.distanceMeters,
          etaSeconds: c.etaSeconds,
          responseReason: c.recommendationReason,
        },
        update: {
          distanceMeters: c.distanceMeters,
          etaSeconds: c.etaSeconds,
          responseReason: c.recommendationReason,
        },
      });

      // Broadcast inbound notice to hospital staff room
      socketService.broadcastToHospital(c.hospitalId, 'emergency:inbound_notice', {
        caseId,
        caseNumber: emergencyCase.caseNumber,
        triagePriority: emergencyCase.triagePriority,
        chiefComplaint: emergencyCase.chiefComplaint,
        etaMinutes: Math.round(c.etaSeconds / 60),
        recommendationReason: c.recommendationReason,
      });
    }

    return topCandidates;
  }

  /**
   * Records hospital acceptance or decline decision with audit trail
   */
  public static async recordHospitalResponse(params: {
    caseId: string;
    hospitalId: string;
    status: HospitalCoordinationStatus;
    bedsReserved: number;
    responseReason: string;
    respondedById: string;
  }) {
    const coordination = await prisma.hospitalCoordination.findUnique({
      where: {
        caseId_hospitalId: {
          caseId: params.caseId,
          hospitalId: params.hospitalId,
        },
      },
    });

    if (!coordination) {
      throw new Error('Coordination record not found for this case and hospital');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const coord = await tx.hospitalCoordination.update({
        where: { id: coordination.id },
        data: {
          status: params.status,
          bedsReserved: params.status === HospitalCoordinationStatus.ACCEPTED ? params.bedsReserved : 0,
          responseReason: params.responseReason,
          respondedById: params.respondedById,
          respondedAt: new Date(),
        },
        include: {
          hospital: { select: { name: true, address: true, contactPhone: true } },
          respondedBy: { select: { fullName: true } },
        },
      });

      // If accepted, reserve bed in HospitalCapacity
      if (params.status === HospitalCoordinationStatus.ACCEPTED && params.bedsReserved > 0) {
        await tx.hospitalCapacity.updateMany({
          where: {
            organizationId: params.hospitalId,
            availableBeds: { gte: params.bedsReserved },
          },
          data: {
            availableBeds: { decrement: params.bedsReserved },
          },
        });
      }

      return coord;
    });

    await auditService.log({
      userId: params.respondedById,
      action: `HOSPITAL_COORDINATION_${params.status}`,
      entityType: 'HospitalCoordination',
      entityId: updated.id,
      metadata: {
        caseId: params.caseId,
        hospitalId: params.hospitalId,
        status: params.status,
        reason: params.responseReason,
      },
    });

    // Broadcast to case and dispatchers
    socketService.broadcastToCase(params.caseId, 'hospital:response', {
      caseId: params.caseId,
      hospitalId: params.hospitalId,
      hospitalName: updated.hospital.name,
      status: params.status,
      responseReason: params.responseReason,
      respondedAt: updated.respondedAt,
    });

    // If hospital accepted, asynchronously send email notification to requester via Brevo
    if (params.status === HospitalCoordinationStatus.ACCEPTED) {
      const sendAcceptanceEmail = async () => {
        const emCase = await prisma.emergencyCase.findUnique({
          where: { id: params.caseId },
          include: { requesterUser: { select: { email: true, fullName: true } } },
        });

        if (emCase) {
          const toEmail = (emCase as any).requesterEmail || emCase.requesterUser?.email;
          const callerName = emCase.requesterName || emCase.requesterUser?.fullName || 'Requester';

          if (toEmail) {
            const trackingUrl = `${env.CORS_ORIGIN}/?track=${emCase.caseNumber}`;
            await emailService.sendHospitalAccepted(
              toEmail,
              callerName,
              emCase.caseNumber,
              updated.hospital.name,
              updated.hospital.address,
              updated.hospital.contactPhone,
              trackingUrl
            );
          }
        }
      };

      sendAcceptanceEmail().catch((err) => console.error('Failed to send hospital acceptance Brevo email', err));
    }

    return updated;
  }
}
