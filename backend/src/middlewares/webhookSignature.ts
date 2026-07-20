import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware to verify Easybox webhook signatures.
 * 
 * Expected headers:
 * - X-Easybox-Timestamp: Unix seconds timestamp
 * - X-Easybox-Signature: sha256=<HMAC-SHA256 hex>
 * 
 * Verification:
 * 1. Extract timestamp and signature from headers
 * 2. Verify timestamp is within 5 minutes (replay protection)
 * 3. Recompute HMAC-SHA256("{timestamp}.{rawBody}") using EASYBOX_WEBHOOK_SECRET
 * 4. Compare computed signature with provided signature (constant-time)
 */
export function verifyEasyboxWebhookSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = process.env.EASYBOX_WEBHOOK_SECRET;
    if (!secret) {
      console.error('EASYBOX_WEBHOOK_SECRET not set');
      return res.status(500).json({ ok: false, error: 'Webhook secret not configured' });
    }

    // Extract headers
    const timestamp = req.headers['x-easybox-timestamp'] as string;
    const signature = req.headers['x-easybox-signature'] as string;

    if (!timestamp || !signature) {
      return res.status(401).json({ ok: false, error: 'Missing webhook headers (timestamp or signature)' });
    }

    // Verify timestamp is within 5 minutes (replay protection)
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    const timeDiff = Math.abs(now - webhookTime);

    if (timeDiff > 300) { // 5 minutes
      return res.status(401).json({ ok: false, error: 'Webhook timestamp outside acceptable window (5 minutes)' });
    }

    // Get raw body (as string)
    const rawBody = typeof req.body === 'string' 
      ? req.body 
      : JSON.stringify(req.body);

    // Compute signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const computed = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const computedSignature = `sha256=${computed}`;

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );

    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
    }

    next();
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    res.status(500).json({ ok: false, error: 'Signature verification failed' });
  }
}
