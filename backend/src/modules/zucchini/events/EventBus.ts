import { EventEmitter } from 'events';
import { logger } from '../../logger';
import { DomainEvent } from './DomainEvents';

/**
 * Event Bus
 *
 * Central event dispatcher for domain events.
 * Enables loose coupling between services.
 */

type EventHandler = (event: DomainEvent) => Promise<void>;
type EventPredicate = (event: DomainEvent) => boolean;

export class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private middleware: Array<(event: DomainEvent) => Promise<void>> = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Subscribe to an event type
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);

    logger.debug('Event handler registered', { eventType, handlers: this.handlers.get(eventType)!.size });

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
      logger.debug('Event handler unregistered', { eventType });
    };
  }

  /**
   * Subscribe with predicate filter
   */
  subscribeWhen(eventType: string, predicate: EventPredicate, handler: EventHandler): () => void {
    const wrappedHandler = async (event: DomainEvent) => {
      if (predicate(event)) {
        await handler(event);
      }
    };

    return this.subscribe(eventType, wrappedHandler);
  }

  /**
   * Add middleware that runs for all events
   */
  use(middleware: (event: DomainEvent) => Promise<void>): void {
    this.middleware.push(middleware);
  }

  /**
   * Emit an event
   */
  async emit(event: DomainEvent): Promise<void> {
    try {
      logger.debug('Event emitted', { eventType: event.type, eventId: event.id });

      // Run middleware
      for (const mw of this.middleware) {
        try {
          await mw(event);
        } catch (error) {
          logger.error('Middleware error', { error, eventType: event.type });
        }
      }

      // Execute handlers
      const handlers = this.handlers.get(event.type);
      if (handlers && handlers.size > 0) {
        const promises = Array.from(handlers).map((handler) =>
          handler(event).catch((error) => {
            logger.error('Event handler error', { error, eventType: event.type, eventId: event.id });
          })
        );

        await Promise.all(promises);
      } else {
        logger.debug('No handlers registered for event', { eventType: event.type });
      }
    } catch (error) {
      logger.error('Error emitting event', { error, eventType: event.type });
    }
  }

  /**
   * Get handler count for event type
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size || 0;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.middleware = [];
    logger.debug('Event bus cleared');
  }
}

// Singleton
let eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBus();
  }
  return eventBus;
}

export function resetEventBus(): void {
  if (eventBus) {
    eventBus.clear();
    eventBus = null;
  }
}
