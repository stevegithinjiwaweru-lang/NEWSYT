/**
 * Domain Events for Zucchini Integration
 *
 * Events are emitted throughout the order processing lifecycle
 * and can be handled by various listeners (queues, webhooks, notifications, etc.)
 */

export interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
}

export class OrderReceivedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.received';
  readonly timestamp = new Date();

  constructor(
    public data: {
      zucchiniOrderId: string;
      storeId: string;
      customerId: string;
      total: number;
      itemCount: number;
    },
    public correlationId?: string
  ) {}
}

export class OrderValidatedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.validated';
  readonly timestamp = new Date();

  constructor(
    public data: {
      zucchiniOrderId: string;
      easyboxOrderId: string;
      validations: string[];
    },
    public correlationId?: string
  ) {}
}

export class OrderMappedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.mapped';
  readonly timestamp = new Date();

  constructor(
    public data: {
      zucchiniOrderId: string;
      easyboxOrderId: string;
      mappingDetails: Record<string, any>;
    },
    public correlationId?: string
  ) {}
}

export class OrderCreatedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.created';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      zucchiniOrderId: string;
      customerId: string;
      total: number;
    },
    public correlationId?: string
  ) {}
}

export class DispatchRequestedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'dispatch.requested';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      storeId: string;
      estimatedDeliveryTime: Date;
      distance: number;
    },
    public correlationId?: string
  ) {}
}

export class RiderAssignedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'rider.assigned';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      riderId: string;
      dispatchId: string;
      estimatedPickupTime: Date;
    },
    public correlationId?: string
  ) {}
}

export class DeliveryCompletedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'delivery.completed';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      riderId: string;
      dispatchId: string;
      completedAt: Date;
      proofOfDelivery?: {
        photos?: string[];
        signature?: string;
      };
    },
    public correlationId?: string
  ) {}
}

export class PaymentReceivedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'payment.received';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      amount: number;
      method: string;
      transactionId: string;
    },
    public correlationId?: string
  ) {}
}

export class OrderCancelledEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.cancelled';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      reason: string;
      refundAmount: number;
    },
    public correlationId?: string
  ) {}
}

export class OrderFailedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'order.failed';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      error: string;
      errorCode: string;
      retryable: boolean;
    },
    public correlationId?: string
  ) {}
}

export class WebhookReceivedEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'webhook.received';
  readonly timestamp = new Date();

  constructor(
    public data: {
      webhookId: string;
      eventType: string;
      payload: Record<string, any>;
      verified: boolean;
    },
    public correlationId?: string
  ) {}
}

export class NotificationSentEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'notification.sent';
  readonly timestamp = new Date();

  constructor(
    public data: {
      orderId: string;
      recipient: string;
      channel: 'SMS' | 'EMAIL' | 'PUSH' | 'WHATSAPP';
      message: string;
    },
    public correlationId?: string
  ) {}
}

export class RetryScheduledEvent implements DomainEvent {
  readonly id = `event-${Date.now()}-${Math.random()}`;
  readonly type = 'retry.scheduled';
  readonly timestamp = new Date();

  constructor(
    public data: {
      originalEventId: string;
      failureReason: string;
      retryCount: number;
      scheduledFor: Date;
    },
    public correlationId?: string
  ) {}
}
