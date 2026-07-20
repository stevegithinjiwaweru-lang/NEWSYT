import { ZucchiniIntegrationError, NotImplementedError } from '../types';

/**
 * Custom error classes for Zucchini integration
 */

export class ZucchiniConnectionError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_CONNECTION_ERROR', message, details, true);
  }
}

export class ZucchiniAuthenticationError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_AUTH_ERROR', message, details, false);
  }
}

export class ZucchiniValidationError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_VALIDATION_ERROR', message, details, false);
  }
}

export class ZucchiniRateLimitError extends ZucchiniIntegrationError {
  constructor(retryAfterSeconds: number, details?: Record<string, any>) {
    super(
      'ZUCCHINI_RATE_LIMIT_ERROR',
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`,
      { ...details, retryAfterSeconds },
      true
    );
  }
}

export class ZucchiniTimeoutError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_TIMEOUT_ERROR', message, details, true);
  }
}

export class ZucchiniWebhookError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_WEBHOOK_ERROR', message, details, true);
  }
}

export class ZucchiniPaymentError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_PAYMENT_ERROR', message, details, true);
  }
}

export class ZucchiniOrderError extends ZucchiniIntegrationError {
  constructor(message: string, details?: Record<string, any>) {
    super('ZUCCHINI_ORDER_ERROR', message, details, true);
  }
}

export class ZucchiniNotImplementedError extends NotImplementedError {
  constructor(method: string) {
    super(method);
  }
}

export function isRetryableError(error: any): boolean {
  if (error instanceof ZucchiniIntegrationError) {
    return error.retryable;
  }
  return false;
}
