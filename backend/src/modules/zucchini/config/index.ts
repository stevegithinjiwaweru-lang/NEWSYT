import { z } from 'zod';

/**
 * Zucchini Integration Configuration
 * Environment-driven, production-ready configuration
 */

const ZucchiniConfigSchema = z.object({
  // API Configuration
  apiBaseUrl: z.string().url('Invalid Zucchini API base URL').default('https://api.zucchini.example'),
  apiKey: z.string().min(1, 'Zucchini API key required').default(''),
  apiSecret: z.string().min(1, 'Zucchini API secret required').default(''),
  apiVersion: z.string().default('v1'),
  apiTimeout: z.number().int().min(1000).default(30000),
  apiRetryAttempts: z.number().int().min(1).default(3),
  apiRetryDelayMs: z.number().int().min(100).default(1000),

  // Webhook Configuration
  webhookSecret: z.string().min(32, 'Webhook secret must be at least 32 characters').default(''),
  webhookPath: z.string().default('/webhooks/zucchini'),
  webhookTimeout: z.number().int().min(5000).default(30000),
  webhookReplayWindow: z.number().int().min(60).default(300), // 5 minutes
  webhookMaxRetries: z.number().int().min(1).default(5),

  // Feature Flags
  enabled: z.boolean().default(false),
  autoDispatch: z.boolean().default(true),
  autoAssign: z.boolean().default(true),
  inventorySync: z.boolean().default(true),
  priceSync: z.boolean().default(true),
  menuSync: z.boolean().default(false), // Disabled by default
  customerSync: z.boolean().default(false),

  // Auto-Dispatch Rules
  autoDispatchDelay: z.number().int().min(0).default(5000), // 5 seconds after order creation
  autoDispatchMaxDistance: z.number().min(0).default(50), // km
  autoDispatchTimeout: z.number().int().min(5000).default(60000), // 1 minute
  autoDispatchRetryInterval: z.number().int().min(1000).default(5000),

  // Notification Configuration
  notificationsEnabled: z.boolean().default(true),
  notifyCustomerOnAssignment: z.boolean().default(true),
  notifyCustomerOnPickup: z.boolean().default(true),
  notifyCustomerOnDelivery: z.boolean().default(true),
  notifyMerchantOnOrder: z.boolean().default(true),
  notifyRiderOnAssignment: z.boolean().default(true),

  // Payment Configuration
  paymentProviders: z.array(z.enum(['MPESA', 'CARD', 'CASH', 'WALLET'])).default(['CASH']),
  autoSettlement: z.boolean().default(false),
  settlementDelay: z.number().int().min(0).default(86400000), // 24 hours

  // Rate Limiting
  rateLimitPerMinute: z.number().int().min(1).default(1000),
  rateLimitPerHour: z.number().int().min(1).default(10000),

  // Queue Configuration
  queueConcurrency: z.number().int().min(1).default(10),
  queueDelayMs: z.number().int().min(0).default(0),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  logWebhooks: z.boolean().default(true),
  logPayloads: z.boolean().default(false), // Security: disable in production

  // Observability
  metricsEnabled: z.boolean().default(true),
  tracingEnabled: z.boolean().default(true),
  healthCheckInterval: z.number().int().min(5000).default(30000),

  // Environment
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

export type ZucchiniConfig = z.infer<typeof ZucchiniConfigSchema>;

/**
 * Load and validate Zucchini configuration from environment variables
 */
export function loadZucchiniConfig(): ZucchiniConfig {
  const rawConfig = {
    apiBaseUrl: process.env.ZUCCHINI_API_BASE_URL,
    apiKey: process.env.ZUCCHINI_API_KEY,
    apiSecret: process.env.ZUCCHINI_API_SECRET,
    apiVersion: process.env.ZUCCHINI_API_VERSION,
    apiTimeout: process.env.ZUCCHINI_API_TIMEOUT ? parseInt(process.env.ZUCCHINI_API_TIMEOUT) : undefined,
    apiRetryAttempts: process.env.ZUCCHINI_API_RETRY_ATTEMPTS ? parseInt(process.env.ZUCCHINI_API_RETRY_ATTEMPTS) : undefined,
    apiRetryDelayMs: process.env.ZUCCHINI_API_RETRY_DELAY ? parseInt(process.env.ZUCCHINI_API_RETRY_DELAY) : undefined,
    webhookSecret: process.env.ZUCCHINI_WEBHOOK_SECRET,
    webhookPath: process.env.ZUCCHINI_WEBHOOK_PATH,
    webhookTimeout: process.env.ZUCCHINI_WEBHOOK_TIMEOUT ? parseInt(process.env.ZUCCHINI_WEBHOOK_TIMEOUT) : undefined,
    webhookReplayWindow: process.env.ZUCCHINI_WEBHOOK_REPLAY_WINDOW ? parseInt(process.env.ZUCCHINI_WEBHOOK_REPLAY_WINDOW) : undefined,
    webhookMaxRetries: process.env.ZUCCHINI_WEBHOOK_MAX_RETRIES ? parseInt(process.env.ZUCCHINI_WEBHOOK_MAX_RETRIES) : undefined,
    enabled: process.env.ZUCCHINI_ENABLED === 'true',
    autoDispatch: process.env.ZUCCHINI_AUTO_DISPATCH !== 'false',
    autoAssign: process.env.ZUCCHINI_AUTO_ASSIGN !== 'false',
    inventorySync: process.env.ZUCCHINI_INVENTORY_SYNC === 'true',
    priceSync: process.env.ZUCCHINI_PRICE_SYNC !== 'false',
    menuSync: process.env.ZUCCHINI_MENU_SYNC === 'true',
    customerSync: process.env.ZUCCHINI_CUSTOMER_SYNC === 'true',
    autoDispatchDelay: process.env.ZUCCHINI_AUTO_DISPATCH_DELAY ? parseInt(process.env.ZUCCHINI_AUTO_DISPATCH_DELAY) : undefined,
    autoDispatchMaxDistance: process.env.ZUCCHINI_AUTO_DISPATCH_MAX_DISTANCE ? parseInt(process.env.ZUCCHINI_AUTO_DISPATCH_MAX_DISTANCE) : undefined,
    autoDispatchTimeout: process.env.ZUCCHINI_AUTO_DISPATCH_TIMEOUT ? parseInt(process.env.ZUCCHINI_AUTO_DISPATCH_TIMEOUT) : undefined,
    notificationsEnabled: process.env.ZUCCHINI_NOTIFICATIONS_ENABLED !== 'false',
    notifyCustomerOnAssignment: process.env.ZUCCHINI_NOTIFY_CUSTOMER_ASSIGNMENT !== 'false',
    notifyCustomerOnPickup: process.env.ZUCCHINI_NOTIFY_CUSTOMER_PICKUP !== 'false',
    notifyCustomerOnDelivery: process.env.ZUCCHINI_NOTIFY_CUSTOMER_DELIVERY !== 'false',
    notifyMerchantOnOrder: process.env.ZUCCHINI_NOTIFY_MERCHANT !== 'false',
    notifyRiderOnAssignment: process.env.ZUCCHINI_NOTIFY_RIDER !== 'false',
    paymentProviders: process.env.ZUCCHINI_PAYMENT_PROVIDERS?.split(','),
    autoSettlement: process.env.ZUCCHINI_AUTO_SETTLEMENT === 'true',
    settlementDelay: process.env.ZUCCHINI_SETTLEMENT_DELAY ? parseInt(process.env.ZUCCHINI_SETTLEMENT_DELAY) : undefined,
    rateLimitPerMinute: process.env.ZUCCHINI_RATE_LIMIT_PER_MIN ? parseInt(process.env.ZUCCHINI_RATE_LIMIT_PER_MIN) : undefined,
    rateLimitPerHour: process.env.ZUCCHINI_RATE_LIMIT_PER_HOUR ? parseInt(process.env.ZUCCHINI_RATE_LIMIT_PER_HOUR) : undefined,
    queueConcurrency: process.env.ZUCCHINI_QUEUE_CONCURRENCY ? parseInt(process.env.ZUCCHINI_QUEUE_CONCURRENCY) : undefined,
    queueDelayMs: process.env.ZUCCHINI_QUEUE_DELAY ? parseInt(process.env.ZUCCHINI_QUEUE_DELAY) : undefined,
    logLevel: process.env.ZUCCHINI_LOG_LEVEL as any,
    logWebhooks: process.env.ZUCCHINI_LOG_WEBHOOKS !== 'false',
    logPayloads: process.env.ZUCCHINI_LOG_PAYLOADS === 'true',
    metricsEnabled: process.env.ZUCCHINI_METRICS !== 'false',
    tracingEnabled: process.env.ZUCCHINI_TRACING !== 'false',
    healthCheckInterval: process.env.ZUCCHINI_HEALTH_CHECK_INTERVAL ? parseInt(process.env.ZUCCHINI_HEALTH_CHECK_INTERVAL) : undefined,
    environment: (process.env.NODE_ENV as any) || 'development',
  };

  try {
    return ZucchiniConfigSchema.parse(rawConfig);
  } catch (error: any) {
    throw new Error(`Invalid Zucchini configuration: ${error.message}`);
  }
}

// Singleton instance
let config: ZucchiniConfig | null = null;

export function getZucchiniConfig(): ZucchiniConfig {
  if (!config) {
    config = loadZucchiniConfig();
  }
  return config;
}

export function resetZucchiniConfig(): void {
  config = null;
}
