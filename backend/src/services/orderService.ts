import { orderRepo } from "../repositories/orderRepository";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { OrderStatus } from "@prisma/client";

const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["DELIVERED", "FAILED", "RETURNED"];
const VALID_ORDER_STATUSES = new Set<string>([
  "NEW",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "RETURNED",
]);

export const orderService = {
  list: async (opts: any) => {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(Number(opts.limit) || 25, 100);
    const skip = (page - 1) * limit;
    const items = await orderRepo.list({
      merchantId: opts.merchantId,
      status: opts.status,
      skip,
      take: limit,
    });
    return { items, page, limit };
  },

  findById: (id: string) => orderRepo.findById(id),

  listMine: async (riderId: string) => {
    return orderRepo.list({
      riderId,
      statusIn: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"],
    });
  },

  create: async (payload: any) => {
    const order = await orderRepo.create(payload);
    logger.info("Order created", { id: order.id });
    return order;
  },

  createFromCsvRow: async (row: any, merchantId: string) => {
    const externalId =
      row["order id"] ?? row["orderid"] ?? row["externalid"] ?? undefined;
    const customerName =
      (row["customer"] ?? row["customername"] ?? row["name"] ?? "").toString().trim();
    const phone = (row["phone"] ?? "").toString().trim();
    const address = (row["address"] ?? "").toString().trim();
    const amount = Number(row["amount"] ?? row["value"] ?? 0);
    const statusRaw = (row["status"] ?? "NEW").toString().toUpperCase();
    const validStatuses = new Set([
      "NEW",
      "ASSIGNED",
      "PICKED_UP",
      "IN_TRANSIT",
      "DELIVERED",
      "FAILED",
      "RETURNED",
    ]);
    const status = validStatuses.has(statusRaw) ? statusRaw : "NEW";

    if (!customerName || !phone || !address || !amount || Number.isNaN(amount)) {
      return null;
    }

    if (externalId) {
      const exists = await orderRepo.findByExternalId(externalId);
      if (exists) return null;
    }

    const data: any = {
      externalId,
      merchantId,
      customerName,
      phone,
      address,
      amount,
      status,
      paymentType: "COD",
    };

    const created = await orderRepo.create(data);
    logger.info("Order created from CSV", { id: created.id, externalId });
    return created;
  },

  assignToRider: async (orderId: string, riderId: string) => {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
        throw new Error("Order is already completed and cannot be reassigned");
      }
      if (order.riderId === riderId) {
        return order;
      }

      const rider = await tx.rider.findUnique({ where: { id: riderId } });
      if (!rider) throw new Error("Rider not found");

      const riderGuard = await tx.rider.updateMany({
        where: { id: riderId, status: "AVAILABLE" },
        data: { status: "BUSY" },
      });
      if (riderGuard.count === 0) throw new Error("Rider is not available");

      const orderGuard = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: TERMINAL_ORDER_STATUSES } },
        data: { riderId, status: "ASSIGNED" },
      });
      if (orderGuard.count === 0) {
        throw new Error("Order has already been assigned or is no longer available");
      }

      if (order.riderId && order.riderId !== riderId) {
        // Reassignment: free the previously-assigned rider.
        await tx.rider.update({ where: { id: order.riderId }, data: { status: "AVAILABLE" } });
      }

      return tx.order.findUnique({
        where: { id: orderId },
        include: { rider: true, merchant: true },
      });
    });

    logger.info("Order assigned", { orderId, riderId });
    return result;
  },

  unassignRider: async (orderId: string) => {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      if (!order.riderId) throw new Error("Order is not currently assigned");
      if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
        throw new Error("Order is already completed and cannot be unassigned");
      }

      const orderGuard = await tx.order.updateMany({
        where: { id: orderId, riderId: order.riderId },
        data: { riderId: null, status: "NEW" },
      });
      if (orderGuard.count === 0) {
        throw new Error("Order has already changed and cannot be unassigned");
      }

      await tx.rider.updateMany({
        where: { id: order.riderId, status: "BUSY" },
        data: { status: "AVAILABLE" },
      });

      return tx.order.findUnique({ where: { id: orderId }, include: { merchant: true } });
    });

    logger.info("Order unassigned", { orderId });
    return result;
  },

  updateStatus: async (orderId: string, status: string, requesterRiderId?: string) => {
    if (!VALID_ORDER_STATUSES.has(status)) {
      throw new Error("Invalid order status");
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");

      if (requesterRiderId && order.riderId !== requesterRiderId) {
        throw new Error("You are not authorized to update this order");
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: status as OrderStatus,
          ...(status === "FAILED" ? { attemptCount: { increment: 1 } } : {}),
        },
      });

      if (order.riderId && TERMINAL_ORDER_STATUSES.includes(status as OrderStatus)) {
        await tx.rider.updateMany({
          where: { id: order.riderId, status: "BUSY" },
          data: { status: "AVAILABLE" },
        });
      }

      return updated;
    });

    logger.info("Order status updated", { orderId, status });
    return result;
  },
};
