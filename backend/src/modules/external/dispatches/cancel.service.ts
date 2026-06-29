import { Order, OrderStatus, RiderStatus } from "@prisma/client";
import { prisma } from "../../../prisma";
import { env } from "../../../config/env";
import {
  AppError,
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/AppError";
import { findZoneForPoint } from "../zones/zones.service";

const FREE_CANCEL_STATUSES: OrderStatus[] = ["NEW", "ASSIGNED"];
const FEE_REQUIRED_STATUSES: OrderStatus[] = ["PICKED_UP", "IN_TRANSIT"];
const TERMINAL_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

export interface CancellationOutcome {
  order: Order;
  fee: number | null;
  currency: string;
}

export interface CancellationFeeQuote {
  fee: number;
  currency: string;
}

async function quoteCancellationFee(order: Order): Promise<CancellationFeeQuote> {
  if (order.lat !== null && order.lng !== null) {
    const zone = await findZoneForPoint({ lat: order.lat, lng: order.lng });
    if (zone) {
      return { fee: round2(zone.baseFee), currency: zone.currency };
    }
  }
  return {
    fee: round2(env.CANCEL_FEE_FALLBACK_AMOUNT),
    currency: env.CANCEL_FEE_FALLBACK_CURRENCY,
  };
}

export async function cancelDispatch(params: {
  merchantId: string;
  dispatchId: string;
  reason: string;
  confirmFee: boolean;
}): Promise<CancellationOutcome> {
  const { merchantId, dispatchId, reason, confirmFee } = params;

  const order = await prisma.order.findFirst({
    where: { id: dispatchId, merchantId },
  });
  if (!order) throw new NotFoundError("Dispatch");

  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new ConflictError(
      `Dispatch is in terminal state (${order.status})`,
      "TERMINAL_STATE",
      { status: order.status }
    );
  }

  let fee = 0;
  let currency = env.CANCEL_FEE_FALLBACK_CURRENCY;

  if (FEE_REQUIRED_STATUSES.includes(order.status)) {
    const quote = await quoteCancellationFee(order);
    fee = quote.fee;
    currency = quote.currency;

    if (!confirmFee) {
      throw new AppError(
        "Cancellation while in progress requires fee confirmation",
        409,
        "CANCEL_REQUIRES_FEE",
        { cancellation_fee: quote.fee, currency: quote.currency }
      );
    }
  } else if (!FREE_CANCEL_STATUSES.includes(order.status)) {
    // Defensive: unknown status — refuse rather than guess.
    throw new ConflictError(
      `Cannot cancel dispatch in state ${order.status}`,
      "INVALID_STATE",
      { status: order.status }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.order.update({
      where: { id: dispatchId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelFee: fee > 0 ? fee : null,
      },
    });

    if (cancelled.riderId) {
      await tx.rider.update({
        where: { id: cancelled.riderId },
        data: { status: RiderStatus.AVAILABLE },
      });
    }

    return cancelled;
  });

  return {
    order: updated,
    fee: fee > 0 ? fee : null,
    currency,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
