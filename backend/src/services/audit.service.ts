import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

class AuditService {
  /**
   * Records an immutable audit log entry into the database
   */
  public async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: params.metadata || {},
        },
      });

      logger.info(`[AUDIT] ${params.action} on ${params.entityType}:${params.entityId || 'N/A'}`, {
        userId: params.userId,
        action: params.action,
      });
    } catch (err: any) {
      // Audit logging must never crash the main application, but should alert
      logger.error('Failed to persist audit log entry', {
        error: err.message,
        params,
      });
    }
  }

  /**
   * Retrieves paginated audit logs with search filters
   */
  public async getLogs(options: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    entityType?: string;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.userId) where.userId = options.userId;
    if (options.action) where.action = { contains: options.action, mode: 'insensitive' };
    if (options.entityType) where.entityType = options.entityType;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
    };
  }
}

export const auditService = new AuditService();
