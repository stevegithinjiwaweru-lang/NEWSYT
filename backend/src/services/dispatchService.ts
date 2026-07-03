import { prisma } from '../prisma';
import { logger } from '../logger';

export async function createDispatch(data: any) {
  // minimal implementation: create dispatch record and return
  const dispatch = await prisma.dispatch.create({ data });
  logger.info('Dispatch created', { id: dispatch.id });
  return dispatch;
}

export async function assignDispatch(dispatchId: string, riderId: string) {
  const updated = await prisma.dispatch.update({ where: { id: dispatchId }, data: { riderId } });
  logger.info('Dispatch assigned', { dispatchId, riderId });
  return updated;
}

export async function getDispatch(id: string) {
  return prisma.dispatch.findUnique({ where: { id } });
}

export async function listDispatches() {
  return prisma.dispatch.findMany({ orderBy: { createdAt: 'desc' } });
}
