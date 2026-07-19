import { prisma } from "../../prisma";

export async function findCustomerByEmail(email: string) {
  return prisma.customer.findUnique({ where: { email } });
}

export async function findCustomerById(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function createCustomer(data: {
  email: string;
  phone?: string | null;
  passwordHash: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return prisma.customer.create({ data });
}

export async function updateCustomer(id: string, data: Partial<{ firstName: string; lastName: string; phone: string }>) {
  return prisma.customer.update({ where: { id }, data });
}

export async function createRefreshToken(token: string, customerId: string, expiresAt: Date) {
  return prisma.refreshToken.create({ data: { token, customerId, expiresAt } });
}

export async function findRefreshToken(token: string) {
  return prisma.refreshToken.findUnique({ where: { token } });
}

export async function deleteRefreshToken(token: string) {
  return prisma.refreshToken.deleteMany({ where: { token } });
}
