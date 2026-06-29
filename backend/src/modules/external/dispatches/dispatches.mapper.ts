import { Order, OrderStatus, Rider } from "@prisma/client";
import { env } from "../../../config/env";

export type ExternalDispatchStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "COLLECTED"
  | "EN_ROUTE"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

const STATUS_MAP: Record<OrderStatus, ExternalDispatchStatus> = {
  NEW: "REQUESTED",
  ASSIGNED: "ASSIGNED",
  PICKED_UP: "COLLECTED",
  IN_TRANSIT: "EN_ROUTE",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  RETURNED: "FAILED",
  CANCELLED: "CANCELLED",
};

export function externalStatus(status: OrderStatus): ExternalDispatchStatus {
  return STATUS_MAP[status];
}

export function trackingUrl(dispatchId: string): string {
  const base = env.EXTERNAL_TRACKING_BASE_URL.replace(/\/$/, "");
  return `${base}/${dispatchId}`;
}

export interface DispatchView {
  id: string;
  external_id: string | null;
  status: ExternalDispatchStatus;
  rider: { name: string; phone: string; bike_reg: string | null } | null;
  eta_minutes: number | null;
  pod_url: string | null;
  tracking_url: string;
  created_at: string;
  updated_at: string;
}

export function toDispatchView(order: Order & { rider?: Rider | null }): DispatchView {
  return {
    id: order.id,
    external_id: order.externalId,
    status: externalStatus(order.status),
    rider: order.rider
      ? { name: order.rider.name, phone: order.rider.phone, bike_reg: order.rider.bikeReg }
      : null,
    eta_minutes: order.etaMinutes,
    pod_url: order.podUrl,
    tracking_url: trackingUrl(order.id),
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  };
}
