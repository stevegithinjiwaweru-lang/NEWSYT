import express from 'express';
import { verifyEasyboxWebhookSignature } from '../middlewares/webhookSignature';
import { handleEasyboxWebhook } from '../controllers/easyboxController';

const router = express.Router();

/**
 * Webhook Routes
 * 
 * These are called BY Easybox to send status updates about dispatches.
 * All webhook requests are verified using HMAC-SHA256 signature.
 */

// POST /webhooks/dispatch/easybox - Handle Easybox dispatch webhook
router.post('/dispatch/easybox', verifyEasyboxWebhookSignature, handleEasyboxWebhook);

export default router;
