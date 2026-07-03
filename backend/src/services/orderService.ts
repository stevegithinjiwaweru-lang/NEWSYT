import { orderRepo } from "../repositories/orderRepository";
import { logger } from "../logger";

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
    const updated = await orderRepo.update(orderId, { riderId, status: "ASSIGNED" });
    logger.info("Order assigned", { orderId, riderId });
    return updated;
  },

  updateStatus: async (orderId: string, status: string) => {
    const updated = await orderRepo.update(orderId, { status });
    logger.info("Order status updated", { orderId, status });
    return updated;
  },
};
