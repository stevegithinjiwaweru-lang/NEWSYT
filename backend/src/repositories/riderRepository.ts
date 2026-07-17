import { prisma } from "../prisma";
import {
  Prisma,
  RiderStatus,
} from "@prisma/client";

export const riderRepo = {
  findById: (id: string) =>
    prisma.rider.findUnique({
      where: { id },
      include: {
        orders: true,
        user: true,
      },
    }),

  findAll: (params: {
    status?: RiderStatus;
    skip?: number;
    take?: number;
  }) =>
    prisma.rider.findMany({
      where: {
        status: params.status ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: params.skip,
      take: params.take,
      include: {
        orders: true,
        user: true,
      },
    }),

  create: (data: Prisma.RiderCreateInput) =>
    prisma.rider.create({
      data,
      include: {
        orders: true,
        user: true,
      },
    }),

  update: (id: string, data: Prisma.RiderUpdateInput) =>
    prisma.rider.update({
      where: { id },
      data,
      include: {
        orders: true,
        user: true,
      },
    }),

  delete: (id: string) =>
    prisma.rider.delete({
      where: { id },
    }),

  findByPhone: (phone: string) =>
    prisma.rider.findFirst({
      where: { phone },
      include: {
        orders: true,
        user: true,
      },
    }),

  findByUserId: (userId: string) =>
    prisma.rider.findUnique({
      where: { userId },
      include: {
        orders: true,
        user: true,
      },
    }),

  updateStatus: (
    id: string,
    status: RiderStatus
  ) =>
    prisma.rider.update({
      where: { id },
      data: { status },
      include: {
        orders: true,
        user: true,
      },
    }),

  updateLocation: (
    id: string,
    lat: number,
    lng: number
  ) =>
    prisma.rider.update({
      where: { id },
      data: {
        lastLat: lat,
        lastLng: lng,
        lastSeenAt: new Date(),
      },
      include: {
        orders: true,
        user: true,
      },
    }),
};