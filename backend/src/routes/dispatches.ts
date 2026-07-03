import express from 'express';
import { prisma } from '../prisma';
import authMiddleware from '../middlewares/auth';
import { createDispatch, assignDispatch, listDispatches, getDispatch } from '../services/dispatchService';
import { io } from '../app';

const router = express.Router();
const requireAuth = authMiddleware;

router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await listDispatches();
    res.json({ ok: true, dispatches: items });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to list dispatches' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { orderReference, status, estimatedDelivery, estimatedPickup, metadata } = req.body;
    if (!orderReference) return res.status(400).json({ ok: false, error: 'orderReference required' });
    const dispatch = await createDispatch({ orderReference, status: status || 'PENDING', estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null, estimatedPickup: estimatedPickup ? new Date(estimatedPickup) : null, metadata });

    io.to('dashboard').emit('dispatch.created', { dispatch });

    res.status(201).json({ ok: true, dispatch });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to create dispatch' });
  }
});

router.post('/:id/assign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ ok: false, error: 'riderId required' });
    const updated = await assignDispatch(id, riderId);
    io.to('dashboard').emit('dispatch.assigned', { dispatch: updated });
    res.json({ ok: true, dispatch: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to assign dispatch' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const d = await getDispatch(id);
    if (!d) return res.status(404).json({ ok: false, error: 'Dispatch not found' });
    res.json({ ok: true, dispatch: d });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch dispatch' });
  }
});

export default router;
