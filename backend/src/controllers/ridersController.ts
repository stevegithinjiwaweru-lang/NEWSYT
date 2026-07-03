import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import { logger } from '../logger';

export async function listRiders(req: Request, res: Response) {
  try {
    const riders = await prisma.rider.findMany({ orderBy: { name: 'asc' }, include: { user: true } });
    return res.json({ ok: true, count: riders.length, riders });
  } catch (err) {
    logger.error('List riders error', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch riders' });
  }
}

export async function createRider(req: Request, res: Response) {
  try {
    const { name, phone, bikeReg, branch, password } = req.body;
    if (!name || !phone) return res.status(400).json({ ok: false, error: 'name and phone are required' });

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    const existingRiderByPhone = await prisma.rider.findFirst({ where: { phone } });
    if (existingRiderByPhone) return res.status(400).json({ ok: false, error: 'A rider with this phone already exists' });

    let userId: string | undefined;
    let tempPassword: string | undefined;

    if (existingUser) {
      const linkedRider = await prisma.rider.findUnique({ where: { userId: existingUser.id } });
      if (linkedRider) return res.status(400).json({ ok: false, error: 'A rider account is already linked to this user' });
      userId = existingUser.id;
    } else {
      tempPassword = password || Math.random().toString(36).slice(-10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.create({ data: { name, phone, passwordHash, role: 'RIDER' } });
      userId = user.id;
    }

    const rider = await prisma.rider.create({ data: { name, phone, bikeReg, branch, status: 'AVAILABLE', userId } });
    return res.status(201).json({ ok: true, rider, tempPassword });
  } catch (err) {
    logger.error('Create rider error', err);
    return res.status(500).json({ ok: false, error: 'Failed to create rider' });
  }
}

export async function updateRider(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.rider.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Rider not found' });
    const rider = await prisma.rider.update({ where: { id }, data: req.body });
    return res.json({ ok: true, rider });
  } catch (err) {
    logger.error('Update rider error', err);
    return res.status(500).json({ ok: false, error: 'Failed to update rider' });
  }
}

export async function deleteRider(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.rider.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Rider not found' });
    await prisma.rider.delete({ where: { id } });
    return res.json({ ok: true, message: 'Rider deleted successfully' });
  } catch (err) {
    logger.error('Delete rider error', err);
    return res.status(500).json({ ok: false, error: 'Failed to delete rider' });
  }
}
