/**
 * Constants for Zucchini integration
 */

export const ZUCCHINI_CONSTANTS = {
  // API Versions
  API_VERSIONS: {
    V1: 'v1',
    V2: 'v2',
  } as const,

  // Event Types
  EVENT_TYPES: {
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_CONFIRMED: 'order.confirmed',
    ORDER_CANCELLED: 'order.cancelled',
    ORDER_DELIVERED: 'order.delivered',
    PAYMENT_RECEIVED: 'payment.received',
    PAYMENT_FAILED: 'payment.failed',
    MENU_UPDATED: 'menu.updated',
    INVENTORY_CHANGED: 'inventory.changed',
    STORE_OPENED: 'store.opened',
    STORE_CLOSED: 'store.closed',
  } as const,

  // Order Statuses
  ORDER_STATUSES: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PREPARING: 'PREPARING',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    DISPATCHED: 'DISPATCHED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
  } as const,

  // Payment Statuses
  PAYMENT_STATUSES: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
  } as const,

  // Payment Methods
  PAYMENT_METHODS: {
    CASH: 'CASH',
    CARD: 'CARD',
    WALLET: 'WALLET',
    MPESA: 'MPESA',
  } as const,

  // HTTP Methods
  HTTP_METHODS: {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
  } as const,

  // Common Strings
  STRINGS: {
    AUTHORIZATION_HEADER: 'Authorization',
    BEARER_PREFIX: 'Bearer',
    HMAC_ALGORITHM: 'sha256',
    HMAC_HEADER: 'X-Zucchini-Signature',
    TIMESTAMP_HEADER: 'X-Zucchini-Timestamp',
    IDEMPOTENCY_HEADER: 'Idempotency-Key',
    REQUEST_ID_HEADER: 'X-Request-ID',
  } as const,

  // Default Values
  DEFAULTS: {
    API_TIMEOUT: 30000,
    WEBHOOK_TIMEOUT: 30000,
    API_RETRY_ATTEMPTS: 3,
    API_RETRY_DELAY: 1000,
    WEBHOOK_MAX_RETRIES: 5,
    AUTO_DISPATCH_DELAY: 5000,
    RATE_LIMIT_PER_MINUTE: 1000,
    RATE_LIMIT_PER_HOUR: 10000,
    QUEUE_CONCURRENCY: 10,
  } as const,

  // Queue Names
  QUEUE_NAMES: {
    ORDER_PROCESSING: 'zucchini:order:processing',
    WEBHOOK_PROCESSING: 'zucchini:webhook:processing',
    SYNC_ORDERS: 'zucchini:sync:orders',
    SYNC_MENU: 'zucchini:sync:menu',
    SYNC_CUSTOMERS: 'zucchini:sync:customers',
    DISPATCH_REQUEST: 'zucchini:dispatch:request',
    PAYMENT_PROCESSING: 'zucchini:payment:processing',
    RETRY_FAILED: 'zucchini:retry:failed',
    NOTIFICATION_SEND: 'zucchini:notification:send',
  } as const,

  // Cache Keys
  CACHE_KEYS: {
    AUTH_TOKEN: 'zucchini:auth:token',
    STORE: 'zucchini:store:',
    MENU: 'zucchini:menu:',
    PRODUCT: 'zucchini:product:',
    CUSTOMER: 'zucchini:customer:',
    ORDER: 'zucchini:order:',
    INTEGRATION_STATUS: 'zucchini:integration:status',
    HEALTH_CHECK: 'zucchini:health:check',
  } as const,

  // Cache TTLs (in seconds)
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 1 day
  } as const,

  // Metrics
  METRICS: {
    API_REQUEST_DURATION: 'zucchini.api.request.duration.ms',
    API_REQUEST_COUNT: 'zucchini.api.request.count',
    API_ERROR_COUNT: 'zucchini.api.error.count',
    WEBHOOK_RECEIVED: 'zucchini.webhook.received',
    WEBHOOK_PROCESSED: 'zucchini.webhook.processed',
    WEBHOOK_FAILED: 'zucchini.webhook.failed',
    ORDER_CREATED: 'zucchini.order.created',
    ORDER_FAILED: 'zucchini.order.failed',
    QUEUE_SIZE: 'zucchini.queue.size',
  } as const,

  // Log Levels
  LOG_LEVELS: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  } as const,

  // Retry Configuration
  RETRY: {
    EXPONENTIAL_BASE: 2,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 60000,
    MAX_ATTEMPTS: 5,
  } as const,

  // Timeouts
  TIMEOUTS: {
    SHORT: 5000,
    MEDIUM: 15000,
    LONG: 30000,
    VERY_LONG: 60000,
  } as const,
} as const;

// Status mappings
export const STATUS_MAPPINGS = {
  // Zucchini → Easybox
  ZUCCHINI_TO_EASYBOX: {
    'PENDING': 'PENDING',
    'CONFIRMED': 'ASSIGNED',
    'PREPARING': 'ASSIGNED',
    'READY_FOR_PICKUP': 'PICKED_UP',
    'DISPATCHED': 'EN_ROUTE',
    'IN_TRANSIT': 'EN_ROUTE',
    'DELIVERED': 'DELIVERED',
    'CANCELLED': 'CANCELLED',
    'FAILED': 'FAILED',
  } as const,

  // Easybox → Zucchini
  EASYBOX_TO_ZUCCHINI: {
    'PENDING': 'PENDING',
    'CREATED': 'CONFIRMED',
    'ASSIGNED': 'CONFIRMED',
    'PICKED_UP': 'READY_FOR_PICKUP',
    'EN_ROUTE': 'DISPATCHED',
    'ARRIVED': 'DISPATCHED',
    'DELIVERED': 'DELIVERED',
    'FAILED': 'FAILED',
    'CANCELLED': 'CANCELLED',
  } as const,
} as const;
