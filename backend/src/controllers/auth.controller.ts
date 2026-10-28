import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { prisma } from '../db/prisma.js';
import { UserRole } from '@prisma/client';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.registerUser(req.body);
      res.status(201).json({
        message: 'Registration successful',
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'REGISTRATION_FAILED' });
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.login(req.body.email, req.body.password, ip, userAgent);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message, code: 'AUTH_FAILED' });
    }
  }

  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          organizationId: true,
          organization: {
            select: { id: true, name: true, type: true },
          },
          createdAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }

  public static async createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const invitation = await AuthService.createInvitation({
        email: req.body.email,
        role: req.body.role as UserRole,
        organizationId: req.body.organizationId,
        invitedById: req.user.userId,
      });

      res.status(201).json({
        message: 'Privileged invitation generated successfully',
        invitation,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  public static async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.acceptInvitation(req.body);
      res.status(200).json({
        message: 'Invitation accepted and account provisioned successfully',
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
