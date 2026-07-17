import { riderRepo } from "../repositories/riderRepository";
import { prisma } from "../prisma";
import { RiderStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { logger } from "../logger";

export const riderService = {
  list: async (opts: any) => {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(Number(opts.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const items = await riderRepo.findAll({
      status: opts.status as RiderStatus | undefined,
      skip,
      take: limit,
    });

    return { items, page, limit };
  },

  findById: async (id: string) => {
    const rider = await riderRepo.findById(id);

    if (!rider) {
      logger.warn("Rider not found", { id });
      return null;
    }

    return rider;
  },

  create: async (payload: any) => {
    const { name, phone, bikeReg, branch, password } = payload;

    if (!name || !phone) {
      throw new Error("Rider name and phone are required");
    }

    const existingRider = await riderRepo.findByPhone(phone);

    if (existingRider) {
      throw new Error("Rider with this phone already exists");
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      throw new Error("User with this phone already exists");
    }

    const passwordHash = await bcrypt.hash(password || phone, 10);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash,
        role: "RIDER",
      },
    });

    const rider = await riderRepo.create({
      name,
      phone,
      bikeReg: bikeReg ?? null,
      branch: branch ?? null,
      status: RiderStatus.AVAILABLE,
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    logger.info("Rider created", {
      id: rider.id,
      name,
      phone,
    });

    return rider;
  },

  update: async (id: string, payload: any) => {
    const { name, phone, bikeReg, branch, status } = payload;

    const rider = await riderRepo.findById(id);

    if (!rider) {
      throw new Error("Rider not found");
    }

    if (phone && phone !== rider.phone) {
      const existing = await riderRepo.findByPhone(phone);

      if (existing) {
        throw new Error("Phone number already in use");
      }
    }

    const updated = await riderRepo.update(id, {
      name,
      phone,
      bikeReg,
      branch,
      status: status ? (status as RiderStatus) : undefined,
    });

    logger.info("Rider updated", {
      id,
      changes: {
        name,
        phone,
        status,
      },
    });

    return updated;
  },

  delete: async (id: string) => {
    const rider = await riderRepo.findById(id);

    if (!rider) {
      throw new Error("Rider not found");
    }

    if (rider.userId) {
      await prisma.user.delete({
        where: {
          id: rider.userId,
        },
      });
    }

    await riderRepo.delete(id);

    logger.info("Rider deleted", { id });
  },

  updateStatus: async (id: string, status: RiderStatus) => {
    const rider = await riderRepo.findById(id);

    if (!rider) {
      throw new Error("Rider not found");
    }

    const updated = await riderRepo.updateStatus(id, status);

    logger.info("Rider status updated", {
      id,
      status,
    });

    return updated;
  },

  updateLocation: async (
    id: string,
    lat: number,
    lng: number
  ) => {
    const rider = await riderRepo.findById(id);

    if (!rider) {
      throw new Error("Rider not found");
    }

    const updated = await riderRepo.updateLocation(id, lat, lng);

    logger.info("Rider location updated", {
      id,
      lat,
      lng,
    });

    return updated;
  },
};