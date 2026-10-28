import { Request, Response, NextFunction } from 'express';
import { AuthService, JwtPayload } from '../services/auth.service.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required: Missing or invalid Authorization Bearer header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = AuthService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid, revoked, or expired authentication token',
      code: 'TOKEN_INVALID',
    });
  }
}
