import { Request, Response, NextFunction } from 'express';
import { prisma, withDbRetry } from '../db/prisma.js';
import { AllocationEngine } from '../services/allocation.service.js';
import { HospitalCoordinationService } from '../services/coordination.service.js';
import { socketService } from '../services/socket.service.js';
import { auditService } from '../services/audit.service.js';
import { emailService } from '../services/email.service.js';
import { env } from '../config/env.js';
import { CaseStatus, UserRole } from '@prisma/client';

export class EmergencyController {
  /**
   * Creates an emergency case with idempotency protection and kicks off concurrent allocation & hospital discovery
   */
  public static async createEmergency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        requesterName,
        requesterPhone,
        requesterEmail,
        pickupLatitude,
        pickupLongitude,
        pickupAddress,
        triagePriority,
        chiefComplaint,
        patientAge,
        patientGender,
        notes,
        idempotencyKey,
      } = req.body;

      // Idempotency check: prevent duplicate submissions from network retries
      if (idempotencyKey) {
        const existing = await withDbRetry(() =>
          prisma.emergencyCase.findUnique({
            where: { idempotencyKey },
            include: {
              allocations: { include: { ambulance: true } },
              coordinations: { include: { hospital: true } },
            },
          })
        );
        if (existing) {
          res.status(200).json({
            message: 'Emergency request retrieved from existing idempotency key',
            case: existing,
          });
          return;
        }
      }

      // Generate human-readable case number: e.g. EMG-K9Z1-8241
      const caseNumber = `EMG-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const emergencyCase = await withDbRetry(() =>
        prisma.emergencyCase.create({
          data: {
            caseNumber,
            requesterName,
            requesterPhone,
            requesterEmail: requesterEmail || null,
            requesterUserId: req.user?.userId || null,
            pickupLatitude,
            pickupLongitude,
            pickupAddress,
            triagePriority,
            chiefComplaint,
            patientAge,
            patientGender,
            notes,
            idempotencyKey: idempotencyKey || null,
            status: CaseStatus.PENDING,
          },
        })
      );

      await auditService.log({
        userId: req.user?.userId || null,
        action: 'EMERGENCY_CASE_CREATED',
        entityType: 'EmergencyCase',
        entityId: emergencyCase.id,
        metadata: {
          caseNumber,
          priority: triagePriority,
          pickup: [pickupLatitude, pickupLongitude],
        },
      });

      // Notify dispatchers in real-time
      socketService.broadcastToDispatchers('emergency:new', emergencyCase);

      // Asynchronously send email notification via Brevo if email is available
      const notificationEmail = requesterEmail || (req.user?.email ?? null);
      if (notificationEmail) {
        const trackingUrl = `${env.CORS_ORIGIN}/?track=${emergencyCase.caseNumber}`;
        emailService.sendEmergencyConfirmation(
          notificationEmail,
          requesterName,
          caseNumber,
          triagePriority,
          pickupAddress,
          trackingUrl
        ).catch((e) => console.error('Brevo confirmation email error:', e));
      }

      // Trigger concurrent allocation and hospital coordination in background
      AllocationEngine.allocateAmbulance(emergencyCase.id).catch((err) => {
        console.error('Allocation error in background:', err);
      });

      HospitalCoordinationService.discoverAndCoordinateHospitals(emergencyCase.id).catch((err) => {
        console.error('Hospital coordination error in background:', err);
      });

      res.status(201).json({
        message: 'Emergency case created successfully and dispatched for allocation',
        case: emergencyCase,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves emergency cases with strict role-based access filtering
   */
  public static async getCases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const role = req.user.role;
      const userId = req.user.userId;
      const orgId = req.user.organizationId;

      const where: any = {};

      if (role === UserRole.PATIENT_REQUESTER) {
        // Patients can only see their own emergency cases
        where.requesterUserId = userId;
      } else if (role === UserRole.HOSPITAL_STAFF && orgId) {
        // Hospital staff only see cases coordinated with their specific hospital
        where.coordinations = {
          some: { hospitalId: orgId },
        };
      } else if (role === UserRole.AMBULANCE_CREW) {
        // Crew only see cases assigned to ambulances where they have an active shift
        where.allocations = {
          some: {
            ambulance: {
              crewAssignments: {
                some: { userId, status: 'ACTIVE' },
              },
            },
          },
        };
      }
      // DISPATCHER and SYSTEM_ADMIN can see all cases

      const cases = await prisma.emergencyCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          allocations: {
            include: {
              ambulance: {
                select: {
                  id: true,
                  callSign: true,
                  registrationNumber: true,
                  type: true,
                  status: true,
                  currentLatitude: true,
                  currentLongitude: true,
                  lastGpsUpdate: true,
                },
              },
            },
          },
          coordinations: {
            include: {
              hospital: {
                select: { id: true, name: true, address: true, contactPhone: true, traumaLevel: true },
              },
            },
          },
          handover: true,
        },
      });

      res.status(200).json({ cases });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves single case by ID with full details
   */
  public static async getCaseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const emergencyCase = await prisma.emergencyCase.findUnique({
        where: { id },
        include: {
          allocations: {
            include: {
              ambulance: {
                include: {
                  crewAssignments: {
                    where: { status: 'ACTIVE' },
                    include: { user: { select: { fullName: true, phone: true, role: true } } },
                  },
                },
              },
            },
          },
          coordinations: {
            include: {
              hospital: true,
            },
          },
          handover: true,
        },
      });

      if (!emergencyCase) {
        res.status(404).json({ error: 'Emergency case not found' });
        return;
      }

      // Authorization check for single case
      if (req.user) {
        const role = req.user.role;
        if (role === UserRole.PATIENT_REQUESTER && emergencyCase.requesterUserId !== req.user.userId) {
          res.status(403).json({ error: 'Access denied: You do not have permission to view this case' });
          return;
        }
      }

      res.status(200).json({ case: emergencyCase });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public tracking by caseNumber (minimal sanitised response for requester live map)
   */
  public static async trackByCaseNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { caseNumber } = req.params;

      const emergencyCase = await prisma.emergencyCase.findUnique({
        where: { caseNumber },
        select: {
          id: true,
          caseNumber: true,
          status: true,
          triagePriority: true,
          pickupAddress: true,
          pickupLatitude: true,
          pickupLongitude: true,
          createdAt: true,
          allocations: {
            where: { status: { not: 'CANCELLED' } },
            orderBy: { assignedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              assignedAt: true,
              arrivedSceneAt: true,
              ambulance: {
                select: {
                  id: true,
                  callSign: true,
                  type: true,
                  currentLatitude: true,
                  currentLongitude: true,
                  lastGpsUpdate: true,
                },
              },
            },
          },
          coordinations: {
            where: { status: 'ACCEPTED' },
            select: {
              status: true,
              hospital: {
                select: { name: true, address: true, contactPhone: true, latitude: true, longitude: true },
              },
            },
          },
        },
      });

      if (!emergencyCase) {
        res.status(404).json({ error: 'Emergency case not found with this case number' });
        return;
      }

      res.status(200).json({ case: emergencyCase });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates case operational status (e.g. CREW_EN_ROUTE -> AT_SCENE -> TRANSPORTING)
   */
  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const currentCase = await prisma.emergencyCase.findUnique({
        where: { id },
        include: { allocations: true },
      });

      if (!currentCase) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.emergencyCase.update({
          where: { id },
          data: { status, notes: notes ? `${currentCase.notes || ''}\n[${new Date().toISOString()}] ${notes}` : undefined },
        });

        // Update timestamps on active allocation
        const activeAlloc = currentCase.allocations.find((a) => a.status === 'ASSIGNED' || a.status === 'EN_ROUTE');
        if (activeAlloc) {
          const timestampData: any = {};
          if (status === CaseStatus.AT_SCENE) timestampData.arrivedSceneAt = new Date();
          if (status === CaseStatus.TRANSPORTING) timestampData.departedSceneAt = new Date();
          if (status === CaseStatus.ARRIVED_HOSPITAL) timestampData.arrivedHospitalAt = new Date();
          if (status === CaseStatus.HANDED_OVER) {
            timestampData.handoverAt = new Date();
            timestampData.completedAt = new Date();
            timestampData.status = 'COMPLETED';

            // Free the ambulance back to AVAILABLE status
            await tx.ambulance.update({
              where: { id: activeAlloc.ambulanceId },
              data: { status: 'AVAILABLE' },
            });
          }

          if (Object.keys(timestampData).length > 0) {
            await tx.caseAllocation.update({
              where: { id: activeAlloc.id },
              data: timestampData,
            });
          }
        }

        return c;
      });

      await auditService.log({
        userId: req.user?.userId,
        action: `CASE_STATUS_${status}`,
        entityType: 'EmergencyCase',
        entityId: id,
        metadata: { prevStatus: currentCase.status, newStatus: status },
      });

      // Broadcast update
      socketService.broadcastToCase(id, 'emergency:status_change', {
        caseId: id,
        status,
        timestamp: new Date().toISOString(),
      });

      res.status(200).json({ message: 'Status updated successfully', case: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manual dispatch allocation override
   */
  public static async manualAllocate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { ambulanceId, reason } = req.body;

      const allocation = await prisma.$transaction(async (tx) => {
        // Check if ambulance is available or force assign
        await tx.ambulance.update({
          where: { id: ambulanceId },
          data: { status: 'DISPATCHED' },
        });

        const newAlloc = await tx.caseAllocation.create({
          data: {
            caseId: id,
            ambulanceId,
            status: 'ASSIGNED',
          },
          include: { ambulance: true },
        });

        await tx.emergencyCase.update({
          where: { id },
          data: { status: CaseStatus.ASSIGNED },
        });

        return newAlloc;
      });

      await auditService.log({
        userId: req.user?.userId,
        action: 'MANUAL_DISPATCH_OVERRIDE',
        entityType: 'EmergencyCase',
        entityId: id,
        metadata: { ambulanceId, reason },
      });

      socketService.broadcastToCase(id, 'emergency:assigned', {
        caseId: id,
        ambulance: allocation.ambulance,
        allocationId: allocation.id,
        isManualOverride: true,
        reason,
      });

      res.status(200).json({
        message: 'Manual allocation override executed successfully',
        allocation,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Records clinical patient handover to hospital
   */
  public static async submitHandover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { hospitalId, receivingDoctorName, receivingNurseName, vitalsSummary, handoverNotes } = req.body;

      const handover = await prisma.$transaction(async (tx) => {
        const h = await tx.patientHandover.create({
          data: {
            caseId: id,
            hospitalId,
            receivingDoctorName,
            receivingNurseName: receivingNurseName || null,
            vitalsSummary,
            handoverNotes,
          },
        });

        await tx.emergencyCase.update({
          where: { id },
          data: { status: CaseStatus.HANDED_OVER },
        });

        return h;
      });

      await auditService.log({
        userId: req.user?.userId,
        action: 'PATIENT_HANDOVER_COMPLETED',
        entityType: 'PatientHandover',
        entityId: handover.id,
        metadata: { caseId: id, hospitalId, doctor: receivingDoctorName },
      });

      socketService.broadcastToCase(id, 'emergency:status_change', {
        caseId: id,
        status: CaseStatus.HANDED_OVER,
        handover,
      });

      res.status(201).json({
        message: 'Patient handover completed and archived successfully',
        handover,
      });
    } catch (err) {
      next(err);
    }
  }
}
