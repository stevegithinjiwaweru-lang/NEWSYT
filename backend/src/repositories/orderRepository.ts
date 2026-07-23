import { prisma } from "../prisma";
import { OrderStatus } from "@prisma/client";

export const orderRepo = {
  findById: (id: string) =>
    prisma.order.findUnique({
      where: { id },
    }),

  findByExternalId: (externalId: string) =>
    prisma.order.findFirst({
      where: { externalId },
    }),

  list: (params: {
    merchantId?: string | null;
    riderId?: string | null;
    status?: OrderStatus;
    statusIn?: OrderStatus[];
    skip?: number;
    take?: number;
  }) =>
    prisma.order.findMany({
      where: {
        merchantId: params.merchantId ?? undefined,
        riderId: params.riderId ?? undefined,
        status: params.status ?? undefined,
        ...(params.statusIn ? { status: { in: params.statusIn } } : {}),
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
    }),
};