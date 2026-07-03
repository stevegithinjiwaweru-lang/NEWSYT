import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error(err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'development') {
    return res.status(status).json({ ok: false, error: message, stack: err.stack });
  }

  return res.status(status).json({ ok: false, error: message });
}
