import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

export async function listMerchants(req: Request, res: Response) {
  try {
    const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, merchants });
  } catch (err) {
    logger.error('Get merchants error', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch merchants' });
  }
}

export async function createMerchant(req: Request, res: Response) {
  try {
    const { name, connector, config } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Merchant name is required' });
    const existing = await prisma.merchant.findFirst({ where: { name: name.trim() } });
    if (existing) return res.status(400).json({ ok: false, error: `Merchant '${name}' already exists` });
    const merchant = await prisma.merchant.create({ data: { name: name.trim(), connector: connector || 'CSV', config: config || {}, status: 'CONNECTED' } });
    logger.info(`Merchant created: ${merchant.name}`);
    return res.status(201).json({ ok: true, merchant });
  } catch (err) {
    logger.error('Create merchant error', err);
    return res.status(500).json({ ok: false, error: 'Failed to create merchant' });
  }
}

export async function updateMerchant(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Merchant not found' });
    const updateData: any = {};
    const { name, status, config } = req.body;
    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (config !== undefined) updateData.config = config;
    updateData.updatedAt = new Date();
    const merchant = await prisma.merchant.update({ where: { id }, data: updateData });
    logger.info(`Merchant updated: ${merchant.name}`);
    return res.json({ ok: true, merchant });
  } catch (err) {
    logger.error('Update merchant error', err);
    return res.status(500).json({ ok: false, error: 'Failed to update merchant' });
  }
}
