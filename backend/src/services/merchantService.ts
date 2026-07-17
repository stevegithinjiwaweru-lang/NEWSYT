import { merchantRepo } from "../repositories/merchantRepository";
import { logger } from "../logger";

export const merchantService = {
  list: async (opts: any) => {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(Number(opts.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const items = await merchantRepo.findAll({
      skip,
      take: limit,
    });

    return { items, page, limit };
  },

  findById: async (id: string) => {
    const merchant = await merchantRepo.findById(id);
    if (!merchant) {
      logger.warn("Merchant not found", { id });
      return null;
    }
    return merchant;
  },

  create: async (payload: any) => {
    const { name, connector, config } = payload;

    if (!name) {
      throw new Error("Merchant name is required");
    }

    const existing = await merchantRepo.findByName(name);
    if (existing) {
      throw new Error("Merchant with this name already exists");
    }

    const merchant = await merchantRepo.create({
      name,
      connector: connector || "API",
      config: config || {},
      status: "CONNECTED",
    });

    logger.info("Merchant created", { id: merchant.id, name });
    return merchant;
  },

  update: async (id: string, payload: any) => {
    const { name, status, config } = payload;

    const merchant = await merchantRepo.findById(id);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const updated = await merchantRepo.update(id, {
      name: name !== undefined ? name : undefined,
      status: status !== undefined ? status : undefined,
      config: config !== undefined ? config : undefined,
      updatedAt: new Date(),
    });

    logger.info("Merchant updated", { id, changes: { name, status } });
    return updated;
  },

  delete: async (id: string) => {
    const merchant = await merchantRepo.findById(id);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    await merchantRepo.delete(id);
    logger.info("Merchant deleted", { id });
  },
};