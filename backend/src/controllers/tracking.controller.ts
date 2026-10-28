import { Request, Response, NextFunction } from 'express';
import { TrackingService } from '../services/tracking.service.js';
import { routingService } from '../services/routing.service.js';

export class TrackingController {
  public static async postLocationUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await TrackingService.processLocationUpdate(req.user.userId, req.body);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'TELEMETRY_REJECTED' });
    }
  }

  public static async getLocationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ambulanceId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const history = await TrackingService.getLocationHistory(ambulanceId, limit);
      res.status(200).json({ history });
    } catch (err) {
      next(err);
    }
  }

  public static async getRoutingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = routingService.getStatus();
      res.status(200).json({ routingStatus: status });
    } catch (err) {
      next(err);
    }
  }
}
