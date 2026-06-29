import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { Request } from "express";
import { redis } from "../../../config/redis";

export const dispatchLocationRateLimit = rateLimit({
  windowMs: 1_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) =>
    `${req.merchant?.id ?? "anon"}:${req.params.id ?? "no-id"}`,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>,
    prefix: "rl:dispatch-loc:",
  }),
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many location requests for this dispatch" },
  },
});
