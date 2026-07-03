import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${elapsed}ms`);
  });
  next();
}
