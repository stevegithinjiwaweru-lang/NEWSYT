import express from 'express';
import { verifyEasyboxWebhookSignature } from '../middlewares/webhookSignature';
import { createDispatchHandler, cancelDispatchHandler, handleEasyboxWebhook } from '../controllers/easyboxController';
import authMiddleware from '../middlewares/auth';

const router = express.Router();
const requireAuth = authMiddleware;

/**
 * Easybox API Routes (v1)
 * 
 * These are called BY Easybox (or the integrating system like Zucchini)
 * to manage dispatch lifecycle.
 */

// POST /v1/dispatches - Create dispatch
router.post('/dispatches', requireAuth, createDispatchHandler);

// POST /v1/dispatches/:dispatchId/cancel - Cancel dispatch
router.post('/dispatches/:dispatchId/cancel', requireAuth, cancelDispatchHandler);

export default router;
