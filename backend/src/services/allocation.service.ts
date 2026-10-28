import { prisma } from '../db/prisma.js';
import { routingService } from './routing.service.js';
import { socketService } from './socket.service.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { calculateHaversineDistance } from '../utils/geo.js';
import {
  Ambulance,
  AmbulanceStatus,
  AmbulanceType,
  CaseStatus,
  TriagePriority,
} from '@prisma/client';

export interface CandidateScore {
  ambulance: Ambulance;
  distanceMeters: number;
  durationSeconds: number;
  typeMatchScore: number;
  proximityScore: number;
  readinessScore: number;
  totalScore: number;
  explanation: string;
}

export interface AllocationResult {
  success: boolean;
  assignedAmbulance?: Ambulance;
  caseAllocationId?: string;
  scoringBreakdown?: CandidateScore[];
  escalated?: boolean;
  message: string;
}

export class AllocationEngine {
  /**
   * Type compatibility map
   */
  private static getRequiredAmbulanceType(priority: TriagePriority): AmbulanceType[] {
    switch (priority) {
      case TriagePriority.CRITICAL_P1:
        return [AmbulanceType.ICU, AmbulanceType.ADVANCED, AmbulanceType.BASIC];
      case TriagePriority.URGENT_P2:
        return [AmbulanceType.ADVANCED, AmbulanceType.ICU, AmbulanceType.BASIC];
      default:
        return [AmbulanceType.BASIC, AmbulanceType.ADVANCED, AmbulanceType.ICU];
    }
  }

  /**
   * Scores an available ambulance candidate based on distance, ETA, equipment suitability, and shift readiness.
   * Total score is between 0 and 100 (higher is better).
   */
  private static async scoreCandidate(
    ambulance: Ambulance,
    pickupLat: number,
    pickupLng: number,
    priority: TriagePriority
  ): Promise<CandidateScore> {
    const ambLat = ambulance.currentLatitude ?? 0;
    const ambLng = ambulance.currentLongitude ?? 0;

    // Proximity / ETA calculation
    let distanceMeters = 0;
    let durationSeconds = 0;

    if (ambulance.currentLatitude && ambulance.currentLongitude) {
      const route = await routingService.getRoute(ambLat, ambLng, pickupLat, pickupLng);
      distanceMeters = route.distanceMeters;
      durationSeconds = route.durationSeconds;
    } else {
      distanceMeters = 50000; // Far penalty if location unknown
      durationSeconds = 3600;
    }

    // 1. Proximity score: Up to 50 points (decays with distance)
    // 0m = 50 pts, 10km (~10,000m) = 25 pts, >25km = 5 pts
    const proximityScore = Math.max(5, Math.round(50 * Math.exp(-distanceMeters / 15000)));

    // 2. Type suitability score: Up to 30 points
    let typeMatchScore = 15;
    if (priority === TriagePriority.CRITICAL_P1 && ambulance.type === AmbulanceType.ICU) {
      typeMatchScore = 30;
    } else if (priority === TriagePriority.CRITICAL_P1 && ambulance.type === AmbulanceType.ADVANCED) {
      typeMatchScore = 25;
    } else if (priority === TriagePriority.URGENT_P2 && (ambulance.type === AmbulanceType.ADVANCED || ambulance.type === AmbulanceType.ICU)) {
      typeMatchScore = 30;
    } else if (ambulance.type === AmbulanceType.BASIC) {
      typeMatchScore = 20;
    }

    // 3. Telemetry and Crew readiness score: Up to 20 points
    let readinessScore = 10;
    if (ambulance.lastGpsUpdate) {
      const secondsSinceUpdate = (Date.now() - new Date(ambulance.lastGpsUpdate).getTime()) / 1000;
      if (secondsSinceUpdate <= 60) readinessScore = 20; // Fresh GPS within 60s
      else if (secondsSinceUpdate <= 300) readinessScore = 15;
    }

    const totalScore = proximityScore + typeMatchScore + readinessScore;
    const explanation = `Score ${totalScore}: Proximity (${proximityScore}pts, ~${Math.round(distanceMeters / 1000)}km, ~${Math.round(durationSeconds / 60)}min), Type ${ambulance.type} (${typeMatchScore}pts), GPS Freshness (${readinessScore}pts)`;

    return {
      ambulance,
      distanceMeters,
      durationSeconds,
      typeMatchScore,
      proximityScore,
      readinessScore,
      totalScore,
      explanation,
    };
  }

  /**
   * Concurrency-safe atomic ambulance allocation using PostgreSQL conditional row update
   * and ACID transaction boundary.
   */
  public static async allocateAmbulance(caseId: string): Promise<AllocationResult> {
    const emergencyCase = await prisma.emergencyCase.findUnique({
      where: { id: caseId },
    });

    if (!emergencyCase) {
      throw new Error(`Emergency case ${caseId} not found`);
    }

    if (emergencyCase.status !== CaseStatus.PENDING && emergencyCase.status !== CaseStatus.ALLOCATING) {
      logger.warn('Allocation skipped: Case is not in PENDING or ALLOCATING state', { caseId, status: emergencyCase.status });
      return {
        success: false,
        message: `Case is already in state ${emergencyCase.status}`,
      };
    }

    // Set case to ALLOCATING state
    await prisma.emergencyCase.update({
      where: { id: caseId },
      data: { status: CaseStatus.ALLOCATING },
    });

    socketService.broadcastToCase(caseId, 'emergency:status_change', {
      caseId,
      status: CaseStatus.ALLOCATING,
      timestamp: new Date().toISOString(),
    });

    // Query candidate ambulances: MUST be AVAILABLE and have at least one active crew shift
    const candidates = await prisma.ambulance.findMany({
      where: {
        status: AmbulanceStatus.AVAILABLE,
        crewAssignments: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
      include: {
        crewAssignments: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { fullName: true, role: true } } },
        },
      },
    });

    if (candidates.length === 0) {
      // Escalation: No ambulances currently available in fleet
      await prisma.emergencyCase.update({
        where: { id: caseId },
        data: { status: CaseStatus.ESCALATED },
      });

      await auditService.log({
        action: 'ALLOCATION_ESCALATED_NO_VEHICLES',
        entityType: 'EmergencyCase',
        entityId: caseId,
        metadata: { reason: 'No available ambulances with active shifts in fleet' },
      });

      socketService.broadcastToCase(caseId, 'emergency:status_change', {
        caseId,
        status: CaseStatus.ESCALATED,
        reason: 'All units currently assigned. Escalated to dispatch coordinator queue.',
      });

      return {
        success: false,
        escalated: true,
        message: 'No units available. Case escalated to dispatcher priority queue.',
      };
    }

    // Rank candidates by scoring algorithm
    const scoredCandidates: CandidateScore[] = [];
    for (const amb of candidates) {
      const score = await this.scoreCandidate(
        amb,
        emergencyCase.pickupLatitude,
        emergencyCase.pickupLongitude,
        emergencyCase.triagePriority
      );
      scoredCandidates.push(score);
    }

    // Sort descending by total score
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    // Concurrency Loop: Attempt atomic assignment in ranked order
    for (const candidate of scoredCandidates) {
      const ambId = candidate.ambulance.id;

      try {
        // Atomic ACID transaction with optimistic lock check:
        // Conditional update ensures that if a concurrent worker already assigned this ambulance,
        // the row count is 0, throwing conflict and trying next candidate.
        const allocation = await prisma.$transaction(async (tx) => {
          // Attempt atomic status transition from AVAILABLE -> DISPATCHED
          const updateResult = await tx.ambulance.updateMany({
            where: {
              id: ambId,
              status: AmbulanceStatus.AVAILABLE,
            },
            data: {
              status: AmbulanceStatus.DISPATCHED,
              updatedAt: new Date(),
            },
          });

          if (updateResult.count === 0) {
            // Race condition detected! Another concurrent request claimed this vehicle.
            throw new Error(`CONCURRENCY_CONFLICT: Ambulance ${ambId} was claimed by another dispatch.`);
          }

          // Create immutable CaseAllocation record
          const newAllocation = await tx.caseAllocation.create({
            data: {
              caseId,
              ambulanceId: ambId,
              status: 'ASSIGNED',
            },
          });

          // Update EmergencyCase status to ASSIGNED
          await tx.emergencyCase.update({
            where: { id: caseId },
            data: {
              status: CaseStatus.ASSIGNED,
            },
          });

          return newAllocation;
        });

        // Allocation succeeded!
        await auditService.log({
          action: 'AMBULANCE_ALLOCATED_SUCCESS',
          entityType: 'EmergencyCase',
          entityId: caseId,
          metadata: {
            ambulanceId: ambId,
            callSign: candidate.ambulance.callSign,
            score: candidate.totalScore,
            explanation: candidate.explanation,
          },
        });

        const assignedAmbulance = await prisma.ambulance.findUnique({
          where: { id: ambId },
          include: {
            crewAssignments: {
              where: { status: 'ACTIVE' },
              include: { user: { select: { fullName: true, phone: true } } },
            },
          },
        });

        // Broadcast real-time assignment event
        socketService.broadcastToCase(caseId, 'emergency:assigned', {
          caseId,
          ambulance: assignedAmbulance,
          allocationId: allocation.id,
          etaMinutes: Math.round(candidate.durationSeconds / 60),
          distanceKm: (candidate.distanceMeters / 1000).toFixed(1),
        });

        socketService.broadcastToDispatchers('emergency:assigned', {
          caseId,
          ambulanceId: ambId,
          allocationId: allocation.id,
          scoringBreakdown: scoredCandidates.map((c) => ({
            callSign: c.ambulance.callSign,
            score: c.totalScore,
            explanation: c.explanation,
          })),
        });

        // Asynchronously notify caller via Brevo if email exists
        const notifyCallerDispatched = async () => {
          let recipientEmail = emergencyCase.requesterEmail;
          let recipientName = emergencyCase.requesterName;

          if (!recipientEmail && emergencyCase.requesterUserId) {
            const user = await prisma.user.findUnique({
              where: { id: emergencyCase.requesterUserId },
              select: { email: true, fullName: true },
            });
            if (user?.email) {
              recipientEmail = user.email;
              recipientName = user.fullName;
            }
          }

          if (recipientEmail) {
            const leadParamedic = assignedAmbulance?.crewAssignments?.[0]?.user;
            const trackingUrl = `${env.CORS_ORIGIN}/?track=${emergencyCase.caseNumber}`;
            await emailService.sendAmbulanceDispatched(
              recipientEmail,
              recipientName,
              emergencyCase.caseNumber,
              candidate.ambulance.callSign,
              Math.round(candidate.durationSeconds / 60),
              leadParamedic?.fullName,
              undefined,
              trackingUrl
            );
          }
        };

        notifyCallerDispatched().catch((e) => console.error('Brevo dispatched email error:', e));

        return {
          success: true,
          assignedAmbulance: assignedAmbulance || undefined,
          caseAllocationId: allocation.id,
          scoringBreakdown: scoredCandidates,
          message: `Ambulance ${candidate.ambulance.callSign} successfully allocated.`,
        };
      } catch (err: any) {
        if (err.message?.includes('CONCURRENCY_CONFLICT')) {
          logger.warn(`Race condition avoided for ambulance ${ambId}. Trying next ranked candidate...`);
          continue; // Try next best ranked candidate
        } else {
          logger.error('Unexpected database error during ambulance allocation', { error: err.message });
          throw err;
        }
      }
    }

    // If loop finishes and all candidates were claimed concurrently:
    await prisma.emergencyCase.update({
      where: { id: caseId },
      data: { status: CaseStatus.ESCALATED },
    });

    socketService.broadcastToCase(caseId, 'emergency:status_change', {
      caseId,
      status: CaseStatus.ESCALATED,
      reason: 'Concurrent assignment conflict on available units. Escalated to dispatch queue.',
    });

    return {
      success: false,
      escalated: true,
      scoringBreakdown: scoredCandidates,
      message: 'All candidate vehicles claimed concurrently. Case escalated to dispatcher.',
    };
  }
}
