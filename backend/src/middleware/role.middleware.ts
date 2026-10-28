import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { auditService } from '../services/audit.service.js';
import { logger } from '../utils/logger.js';

export function requireRoles(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Access forbidden: User lacking required role', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
      });

      await auditService.log({
        userId: req.user.userId,
        action: 'ACCESS_DENIED_ROLE_MISMATCH',
        entityType: 'Endpoint',
        entityId: req.originalUrl,
        metadata: { userRole: req.user.role, requiredRoles: allowedRoles },
      });

      res.status(403).json({
        error: 'Forbidden: Insufficient privileges to perform this operation',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
