import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma, withDbRetry } from '../db/prisma.js';
import { env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import { UserRole, UserStatus } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
}

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  public static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
      algorithm: 'HS256',
    });
  }

  public static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }

  /**
   * Role-based registration: Supports PATIENT_REQUESTER, DISPATCHER, AMBULANCE_CREW, HOSPITAL_STAFF, and SYSTEM_ADMIN
   */
  public static async registerUser(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    organizationId?: string;
  }) {
    return withDbRetry(async () => {
      const normalizedEmail = data.email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedEmail }, ...(data.phone ? [{ phone: data.phone.trim() }] : [])],
        },
      });

      if (existing) {
        throw new Error('An account with this email or phone number already exists');
      }

      const passwordHash = await this.hashPassword(data.password);
      const targetRole = data.role || UserRole.PATIENT_REQUESTER;

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          phone: data.phone?.trim() || null,
          fullName: data.fullName.trim(),
          passwordHash,
          role: targetRole,
          organizationId: data.organizationId || null,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          organizationId: true,
          createdAt: true,
        },
      });

      await auditService.log({
        userId: user.id,
        action: `USER_REGISTER_${targetRole}`,
        entityType: 'User',
        entityId: user.id,
      });

      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      return { user, token };
    });
  }

  public static async registerPatient(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    return this.registerUser({ ...data, role: UserRole.PATIENT_REQUESTER });
  }

  /**
   * Secure login with rate-limiting, failed attempt counter, and account lockout
   */
  public static async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await withDbRetry(async () => {
      return prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
    });

    if (!user) {
      // Use constant-time comparison to prevent timing attacks
      await bcrypt.compare(password, '$2a$12$e846Z6yR4n1.k98U1h9BDeZ6/lqLp3u3uK1h.JgM.y2C71JkP/0ee');
      throw new Error('Invalid email or password');
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingSeconds = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000);
      throw new Error(`Account temporarily locked due to excessive failed attempts. Try again in ${remainingSeconds} seconds.`);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error(`Account is currently ${user.status.toLowerCase()}. Contact operations administrator.`);
    }

    const isMatch = await this.verifyPassword(password, user.passwordHash);

    if (!isMatch) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const willLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockoutUntil = willLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockoutUntil,
        },
      });

      await auditService.log({
        userId: user.id,
        action: willLock ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { failedAttempts, locked: willLock },
      });

      if (willLock) {
        throw new Error('Too many failed login attempts. Account locked for 15 minutes.');
      }
      throw new Error('Invalid email or password');
    }

    // Reset failed login counter on success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await auditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      token,
    };
  }

  /**
   * Generates a cryptographically secure invitation for privileged role
   */
  public static async createInvitation(data: {
    email: string;
    role: UserRole;
    organizationId?: string;
    invitedById: string;
  }) {
    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hour invitation window

    await prisma.userInvitation.create({
      data: {
        email: data.email.toLowerCase().trim(),
        role: data.role,
        organizationId: data.organizationId || null,
        tokenHash,
        invitedById: data.invitedById,
        expiresAt,
      },
    });

    await auditService.log({
      userId: data.invitedById,
      action: 'USER_INVITATION_CREATED',
      entityType: 'UserInvitation',
      metadata: { targetEmail: data.email, role: data.role },
    });

    // Send invitation email via Brevo
    const inviteUrl = `${env.CORS_ORIGIN}/?invite=${rawToken}`;
    emailService.sendStaffInvitation(data.email, data.role, inviteUrl, expiresAt)
      .catch((e) => console.error('Brevo staff invitation email error:', e));

    return {
      email: data.email,
      role: data.role,
      invitationToken: rawToken, // Provided once to send via email / secure channel
      expiresAt,
    };
  }

  /**
   * Accepts invitation and provisions privileged account
   */
  public static async acceptInvitation(data: {
    token: string;
    fullName: string;
    password: string;
    phone?: string;
  }) {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    const invitation = await prisma.userInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new Error('Invalid or revoked invitation token');
    }

    if (invitation.acceptedAt) {
      throw new Error('This invitation has already been accepted');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('This invitation has expired');
    }

    const passwordHash = await this.hashPassword(data.password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          fullName: data.fullName.trim(),
          phone: data.phone?.trim() || null,
          passwordHash,
          role: invitation.role,
          status: UserStatus.ACTIVE,
          organizationId: invitation.organizationId,
          isEmailVerified: true,
        },
      });

      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return newUser;
    });

    await auditService.log({
      userId: user.id,
      action: 'USER_INVITATION_ACCEPTED',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: user.role, organizationId: user.organizationId },
    });

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
      token,
    };
  }
}
