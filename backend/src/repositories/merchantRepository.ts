import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export const merchantRepo = {
  findById: (id: string) =>
    prisma.merchant.findUnique({ where: { id }, include: { orders: true } }),

  findAll: (params: {
    skip?: number;
    take?: number;
  }) =>
    prisma.merchant.findMany({
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: { orders: true },
    }),

  create: (data: Prisma.MerchantCreateInput) =>
    prisma.merchant.create({ data, include: { orders: true } }),

  update: (id: string, data: Prisma.MerchantUpdateInput) =>
    prisma.merchant.update({ where: { id }, data, include: { orders: true } }),

  delete: (id: string) => prisma.merchant.delete({ where: { id } }),

  findByName: (name: string) =>
    prisma.merchant.findFirst({ where: { name } }),
};