import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { auditService } from '../services/audit.service.js';
import { socketService } from '../services/socket.service.js';
import { AmbulanceStatus } from '@prisma/client';

export class AmbulanceController {
  public static async getAmbulances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ambulances = await prisma.ambulance.findMany({
        orderBy: { callSign: 'asc' },
        include: {
          crewAssignments: {
            where: { status: 'ACTIVE' },
            include: { user: { select: { id: true, fullName: true, phone: true } } },
          },
        },
      });

      res.status(200).json({ ambulances });
    } catch (err) {
      next(err);
    }
  }

  public static async getAmbulanceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const ambulance = await prisma.ambulance.findUnique({
        where: { id },
        include: {
          crewAssignments: {
            where: { status: 'ACTIVE' },
            include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
          },
          caseAllocations: {
            where: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING'] } },
            include: { emergencyCase: true },
          },
        },
      });

      if (!ambulance) {
        res.status(404).json({ error: 'Ambulance not found' });
        return;
      }

      res.status(200).json({ ambulance });
    } catch (err) {
      next(err);
    }
  }

  public static async createAmbulance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { registrationNumber, callSign, type, equipmentList } = req.body;

      const existing = await prisma.ambulance.findFirst({
        where: { OR: [{ registrationNumber }, { callSign }] },
      });

      if (existing) {
        res.status(400).json({ error: 'Ambulance with this registration number or call sign already exists' });
        return;
      }

      const ambulance = await prisma.ambulance.create({
        data: {
          registrationNumber,
          callSign,
          type,
          equipmentList,
          status: AmbulanceStatus.AVAILABLE,
        },
      });

      await auditService.log({
        userId: req.user?.userId,
        action: 'AMBULANCE_CREATED',
        entityType: 'Ambulance',
        entityId: ambulance.id,
        metadata: { callSign, registrationNumber, type },
      });

      res.status(201).json({ message: 'Ambulance registered successfully', ambulance });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const ambulance = await prisma.ambulance.update({
        where: { id },
        data: { status },
      });

      await auditService.log({
        userId: req.user?.userId,
        action: `AMBULANCE_STATUS_${status}`,
        entityType: 'Ambulance',
        entityId: id,
      });

      socketService.broadcastToDispatchers('ambulance:status_change', {
        ambulanceId: id,
        status,
      });

      res.status(200).json({ message: 'Ambulance status updated', ambulance });
    } catch (err) {
      next(err);
    }
  }

  public static async assignCrewShift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ambulanceId, userId, roleOnCrew } = req.body;

      // Close any active shift for this user first
      await prisma.crewAssignment.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', shiftEnd: new Date() },
      });

      const shift = await prisma.crewAssignment.create({
        data: {
          ambulanceId,
          userId,
          roleOnCrew,
          status: 'ACTIVE',
        },
        include: {
          user: { select: { fullName: true, role: true } },
          ambulance: { select: { callSign: true } },
        },
      });

      await auditService.log({
        userId: req.user?.userId,
        action: 'CREW_SHIFT_ASSIGNED',
        entityType: 'CrewAssignment',
        entityId: shift.id,
        metadata: { ambulanceId, userId, roleOnCrew },
      });

      res.status(201).json({ message: 'Crew member assigned to shift', shift });
    } catch (err) {
      next(err);
    }
  }

  public static async endShift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params; // Ambulance ID
      const userId = req.user?.userId;

      await prisma.crewAssignment.updateMany({
        where: { ambulanceId: id, userId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', shiftEnd: new Date() },
      });

      await auditService.log({
        userId,
        action: 'CREW_SHIFT_ENDED',
        entityType: 'Ambulance',
        entityId: id,
      });

      res.status(200).json({ message: 'Shift ended successfully' });
    } catch (err) {
      next(err);
    }
  }
}
