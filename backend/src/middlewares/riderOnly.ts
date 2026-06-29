import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

export function riderOnly(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role !== "RIDER") {
    return res.status(403).json({ error: "Rider access only" });
  }

  next();
}