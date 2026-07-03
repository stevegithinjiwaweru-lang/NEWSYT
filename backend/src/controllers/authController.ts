import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { add } from 'date-fns';
import { logger } from '../logger';

export async function register(req: Request, res: Response) {
  const { name, phone, password, role } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password required' });

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return res.status(409).json({ error: 'User already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name: name || phone, phone, passwordHash, role: role || 'DISPATCHER' } });

  return res.status(201).json({ ok: true, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
}

export async function login(req: Request, res: Response) {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password required' });

  const user = await prisma.user.findUnique({ where: { phone }, include: { rider: true } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });

  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: add(new Date(), { days: 7 }) } });

  return res.json({ ok: true, accessToken, refreshToken, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, riderId: user.rider?.id ?? null } });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!storedToken) return res.status(401).json({ error: 'Invalid refresh token' });

  try {
    const payload = verifyRefreshToken(refreshToken) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    // rotate refresh token: delete old and issue new
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    const newRefresh = signRefreshToken({ sub: payload.sub });
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: payload.sub, expiresAt: add(new Date(), { days: 7 }) } });
    const accessToken = signAccessToken({ sub: payload.sub, role: user?.role });
    return res.json({ ok: true, accessToken, refreshToken: newRefresh });
  } catch (err) {
    logger.error('Refresh token verification failed', err);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  return res.json({ ok: true });
}
