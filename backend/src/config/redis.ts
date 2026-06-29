import IORedis, { RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "../shared/logger";

const options: RedisOptions = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
};

export const redis = new IORedis(env.REDIS_URL, options);

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err: err.message }, "Redis error"));
