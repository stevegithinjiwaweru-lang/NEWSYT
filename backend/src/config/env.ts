import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  API_KEY_PEPPER: z.string().min(32, "API_KEY_PEPPER must be at least 32 chars"),

  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(10),
  WEBHOOK_BASE_BACKOFF_MS: z.coerce.number().int().min(100).default(5000),

  EXTERNAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  EXTERNAL_RATE_LIMIT_MAX: z.coerce.number().int().default(60),

  EXTERNAL_TRACKING_BASE_URL: z.string().url().default("http://localhost:5173/track"),

  CANCEL_FEE_FALLBACK_AMOUNT: z.coerce.number().nonnegative().default(200),
  CANCEL_FEE_FALLBACK_CURRENCY: z.string().length(3).default("KES"),

  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),

  UPLOADS_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`❌ Invalid environment variables:\n${issues}`);
    process.exit(1);
  }

  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
