import express from 'express';
import authMiddleware from '../middlewares/auth';
import { createDispatch, assignDispatch, listDispatches, getDispatch } from '../services/dispatchService';
import { statusForError } from '../utils/httpErrors';
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
    const { orderReference, estimatedDelivery, estimatedPickup, metadata } = req.body;
    if (!orderReference) return res.status(400).json({ ok: false, error: 'orderReference required' });
    const dispatch = await createDispatch({
      orderReference,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
      estimatedPickup: estimatedPickup ? new Date(estimatedPickup) : undefined,
      metadata,
    });

    io.to('dashboard').emit('dispatch:created', { dispatch });

    res.status(201).json({ ok: true, dispatch });
  } catch (err: any) {
    const message = err?.message || 'Failed to create dispatch';
    res.status(statusForError(message)).json({ ok: false, error: message });
  }
});

router.post('/:id/assign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ ok: false, error: 'riderId required' });
    const updated: any = await assignDispatch(id, riderId);

    io.to(`rider:${riderId}`).emit('dispatch:assigned', { dispatch: updated });
    io.to('dashboard').emit('dispatch:assigned', { dispatch: updated });

    res.json({ ok: true, dispatch: updated });
  } catch (err: any) {
    const message = err?.message || 'Failed to assign dispatch';
    res.status(statusForError(message)).json({ ok: false, error: message });
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
