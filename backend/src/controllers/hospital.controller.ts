import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { HospitalCoordinationService } from '../services/coordination.service.js';
import { auditService } from '../services/audit.service.js';
import { socketService } from '../services/socket.service.js';
import { HospitalCoordinationStatus } from '@prisma/client';

export class HospitalController {
  public static async getHospitals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitals = await prisma.organization.findMany({
        where: { type: 'HOSPITAL' },
        orderBy: { name: 'asc' },
        include: {
          hospitalCapacity: {
            include: {
              lastUpdatedBy: { select: { fullName: true } },
            },
          },
        },
      });

      res.status(200).json({ hospitals });
    } catch (err) {
      next(err);
    }
  }

  public static async getHospitalById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const hospital = await prisma.organization.findUnique({
        where: { id },
        include: {
          hospitalCapacity: {
            include: {
              lastUpdatedBy: { select: { fullName: true } },
            },
          },
          coordinations: {
            where: { status: { in: ['RECOMMENDED', 'CONTACTED', 'ACCEPTED'] } },
            orderBy: { createdAt: 'desc' },
            include: {
              emergencyCase: {
                select: {
                  id: true,
                  caseNumber: true,
                  triagePriority: true,
                  chiefComplaint: true,
                  status: true,
                  pickupAddress: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!hospital) {
        res.status(404).json({ error: 'Hospital not found' });
        return;
      }

      res.status(200).json({ hospital });
    } catch (err) {
      next(err);
    }
  }

  public static async createHospital(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, address, latitude, longitude, contactPhone, traumaLevel, verified } = req.body;

      const hospital = await prisma.organization.create({
        data: {
          name,
          type: 'HOSPITAL',
          address,
          latitude,
          longitude,
          contactPhone,
          traumaLevel: traumaLevel || null,
          verified: verified ?? false,
        },
      });

      // Initialize blank capacity observation
      if (req.user) {
        await prisma.hospitalCapacity.create({
          data: {
            organizationId: hospital.id,
            totalBeds: 0,
            availableBeds: 0,
            icuBedsTotal: 0,
            icuBedsAvailable: 0,
            oxygenAvailable: true,
            ventilatorAvailable: true,
            lastUpdatedById: req.user.userId,
          },
        });
      }

      await auditService.log({
        userId: req.user?.userId,
        action: 'HOSPITAL_FACILITY_CREATED',
        entityType: 'Organization',
        entityId: hospital.id,
        metadata: { name, traumaLevel, verified },
      });

      res.status(201).json({ message: 'Hospital facility created successfully', hospital });
    } catch (err) {
      next(err);
    }
  }

  public static async updateCapacity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hospitalId } = req.params;
      const { totalBeds, availableBeds, icuBedsTotal, icuBedsAvailable, oxygenAvailable, ventilatorAvailable } = req.body;

      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check organization affiliation if hospital staff
      if (req.user.role === 'HOSPITAL_STAFF' && req.user.organizationId !== hospitalId) {
        res.status(403).json({ error: 'Forbidden: You can only update capacity for your affiliated hospital' });
        return;
      }

      const capacity = await prisma.hospitalCapacity.upsert({
        where: { organizationId: hospitalId },
        create: {
          organizationId: hospitalId,
          totalBeds,
          availableBeds,
          icuBedsTotal,
          icuBedsAvailable,
          oxygenAvailable,
          ventilatorAvailable,
          lastUpdatedById: req.user.userId,
        },
        update: {
          totalBeds,
          availableBeds,
          icuBedsTotal,
          icuBedsAvailable,
          oxygenAvailable,
          ventilatorAvailable,
          lastUpdatedById: req.user.userId,
          updatedAt: new Date(),
        },
      });

      await auditService.log({
        userId: req.user.userId,
        action: 'HOSPITAL_CAPACITY_UPDATED',
        entityType: 'HospitalCapacity',
        entityId: capacity.id,
        metadata: { hospitalId, availableBeds, icuBedsAvailable },
      });

      socketService.broadcastToDispatchers('hospital:capacity_update', {
        hospitalId,
        availableBeds,
        icuBedsAvailable,
        updatedAt: capacity.updatedAt,
      });

      res.status(200).json({ message: 'Hospital capacity updated successfully', capacity });
    } catch (err) {
      next(err);
    }
  }

  public static async respondCoordination(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { caseId, hospitalId } = req.params;
      const { status, bedsReserved, responseReason } = req.body;

      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (req.user.role === 'HOSPITAL_STAFF' && req.user.organizationId !== hospitalId) {
        res.status(403).json({ error: 'Forbidden: You cannot respond on behalf of another hospital' });
        return;
      }

      const result = await HospitalCoordinationService.recordHospitalResponse({
        caseId,
        hospitalId,
        status: status as HospitalCoordinationStatus,
        bedsReserved: bedsReserved ?? 1,
        responseReason,
        respondedById: req.user.userId,
      });

      res.status(200).json({
        message: `Hospital coordination decision '${status}' recorded successfully`,
        coordination: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
