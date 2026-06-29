import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../../../config/redis";
import { env } from "../../../config/env";
import { Request } from "express";

export const externalRateLimit = rateLimit({
  windowMs: env.EXTERNAL_RATE_LIMIT_WINDOW_MS,
  limit: env.EXTERNAL_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.merchant?.id ?? req.ip ?? "anon",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>,
    prefix: "rl:external:",
  }),
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  },
});
