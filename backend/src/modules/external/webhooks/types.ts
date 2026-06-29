export type DispatchEventName =
  | "dispatch.created"
  | "dispatch.assigned"
  | "dispatch.picked_up"
  | "dispatch.en_route"
  | "dispatch.delivered"
  | "dispatch.failed"
  | "dispatch.cancelled"
  | "dispatch.payment_collected";

export interface WebhookEnvelope<T = Record<string, unknown>> {
  id: string;
  event: DispatchEventName;
  occurred_at: string;
  /** Alias of {@link occurred_at} — Gumza-style consumers expect `timestamp`. */
  timestamp: string;
  data: T;
}
