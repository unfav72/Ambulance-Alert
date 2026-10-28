import { Request, Response, NextFunction } from 'express';
import { prisma, checkDatabaseConnection } from '../db/prisma.js';
import { auditService } from '../services/audit.service.js';
import { routingService } from '../services/routing.service.js';
import { UserStatus } from '@prisma/client';

export class AdminController {
  public static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;

      const result = await auditService.getLogs({ page, limit, action, entityType });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          isEmailVerified: true,
          organizationId: true,
          organization: { select: { name: true, type: true } },
          createdAt: true,
          lastLoginAt: true,
        },
      });

      res.status(200).json({ users });
    } catch (err) {
      next(err);
    }
  }

  public static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: { status: status as UserStatus },
      });

      await auditService.log({
        userId: req.user?.userId,
        action: `USER_STATUS_${status}`,
        entityType: 'User',
        entityId: id,
        metadata: { newStatus: status },
      });

      res.status(200).json({ message: 'User status updated', user: { id: user.id, email: user.email, status: user.status } });
    } catch (err) {
      next(err);
    }
  }

  public static async getSystemHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbCheck = await checkDatabaseConnection();
      const routingStatus = routingService.getStatus();

      const memoryUsage = process.memoryUsage();

      const health = {
        status: dbCheck.ok ? 'HEALTHY' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        database: {
          connected: dbCheck.ok,
          error: dbCheck.error,
        },
        routingProvider: routingStatus,
        memory: {
          rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        },
        environment: process.env.NODE_ENV || 'development',
      };

      res.status(dbCheck.ok ? 200 : 503).json(health);
    } catch (err) {
      next(err);
    }
  }
}
