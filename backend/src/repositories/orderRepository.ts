import { prisma } from "../prisma";
import { OrderStatus } from "@prisma/client";

export const orderRepo = {
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
    }),

  findByExternalId: (externalId: string) =>
    prisma.order.findUnique({
      where: { externalId },
    }),

  list: (params: {
    merchantId?: string | null;
    status?: OrderStatus;
    skip?: number;
    take?: number;
  }) =>
    prisma.order.findMany({
      where: {
        merchantId: params.merchantId ?? undefined,
        status: params.status ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: params.skip,
      take: params.take,
      include: {
        merchant: true,
        rider: true,
      },
    }),

  create: (data: any) =>
    prisma.order.create({
      data,
    }),

  update: (id: string, data: any) =>
    prisma.order.update({
      where: { id },
      data,
    }),

  delete: (id: string) =>
    prisma.order.delete({
      where: { id },
    }),

  createMany: (rows: any[]) =>
    prisma.order.createMany({
      data: rows,
      skipDuplicates: true,
    }),
};