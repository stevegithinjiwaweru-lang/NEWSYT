import { Order, OrderStatus, PaymentMethod, Rider } from "@prisma/client";
import { publishDispatchEvent } from "./publisher";
import { DispatchEventName } from "./types";
import { externalStatus } from "../dispatches/dispatches.mapper";
import { logger } from "../../../shared/logger";

const STATUS_EVENT: Partial<Record<OrderStatus, DispatchEventName>> = {
  ASSIGNED: "dispatch.assigned",
  PICKED_UP: "dispatch.picked_up",
  IN_TRANSIT: "dispatch.en_route",
  DELIVERED: "dispatch.delivered",
  FAILED: "dispatch.failed",
  RETURNED: "dispatch.failed",
  CANCELLED: "dispatch.cancelled",
};

function baseFields(order: Order) {
  return {
    dispatch_id: order.id,
    external_id: order.externalId,
    order_reference: order.externalId,
  };
}

function riderFields(rider: Rider | null | undefined) {
  if (!rider) return null;
  return {
    id: rider.id,
    name: rider.name,
    phone: rider.phone,
    vehicle_plate: rider.bikeReg,
  };
}

export async function publishDispatchCreated(
  order: Order & { rider?: Rider | null }
): Promise<void> {
  try {
    await publishDispatchEvent(order.merchantId, "dispatch.created", {
      ...baseFields(order),
      status: externalStatus(order.status),
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, orderId: order.id },
      "Failed to enqueue dispatch.created webhook event"
    );
  }
}

export async function publishOrderStatusEvent(
  order: Order & { rider?: Rider | null },
  options: { reason?: string } = {}
): Promise<void> {
  const event = STATUS_EVENT[order.status];
  if (!event) return;

  try {
    await publishDispatchEvent(order.merchantId, event, {
      ...baseFields(order),
      status: externalStatus(order.status),
      rider: riderFields(order.rider),
      pod_url: order.podUrl ?? null,
      reason: options.reason ?? null,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, orderId: order.id, event },
      "Failed to enqueue dispatch webhook event"
    );
  }
}

export async function publishCancellationEvent(
  order: Order,
  options: {
    reason: string;
    fee: number | null;
    currency: string;
    cancelledBy: "merchant" | "operator" | "system";
  }
): Promise<void> {
  try {
    await publishDispatchEvent(order.merchantId, "dispatch.cancelled", {
      ...baseFields(order),
      status: "CANCELLED",
      reason: options.reason,
      cancellation_fee: options.fee,
      currency: options.currency,
      cancelled_by: options.cancelledBy,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, orderId: order.id },
      "Failed to enqueue dispatch.cancelled webhook"
    );
  }
}

export async function publishPaymentCollectedEvent(
  order: Order,
  options: {
    method: PaymentMethod;
    amount: number;
    reference: string | null;
  }
): Promise<void> {
  try {
    await publishDispatchEvent(order.merchantId, "dispatch.payment_collected", {
      ...baseFields(order),
      method: options.method,
      amount: options.amount,
      reference: options.reference,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, orderId: order.id },
      "Failed to enqueue dispatch.payment_collected webhook"
    );
  }
}
