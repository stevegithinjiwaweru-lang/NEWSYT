import { Request, Response, NextFunction } from "express";

export function validate(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = { ...req.body, ...req.query, ...req.params };
      const parsed = schema.parse(data);
      req.body = { ...req.body, ...parsed };
      return next();
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err.errors || err.message });
    }
  };
}
