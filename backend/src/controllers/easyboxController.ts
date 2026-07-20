import { Request, Response } from 'express';
import { createDispatch, cancelDispatch, getDispatchByOrderReference, handleDispatchWebhookEvent } from '../services/dispatchService';
import { logger } from '../logger';

/**
 * POST /v1/dispatches
 * Create a dispatch (called by Easybox when Zucchini wants to send a delivery)
 */
export async function createDispatchHandler(req: Request, res: Response) {
  try {
    const {
      order_reference,
      pickup,
      delivery,
      package: pkg,
      payment_on_delivery,
    } = req.body;

    if (!order_reference) {
      return res.status(400).json({ ok: false, error: 'order_reference is required' });
    }

    // Check if dispatch already exists for this order
    const existing = await getDispatchByOrderReference(order_reference);
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: 'Dispatch already exists for this order',
        dispatch_id: existing.id,
      });
    }

    // Create the dispatch
    const dispatch = await createDispatch({
      orderReference: order_reference,
      pickupLat: pickup?.latitude,
      pickupLng: pickup?.longitude,
      deliveryLat: delivery?.latitude,
      deliveryLng: delivery?.longitude,
      estimatedDelivery: new Date(), // Placeholder; Easybox would set actual estimate
      packageDescription: pkg?.description,
      packageWeight: pkg?.weight,
      packageValue: pkg?.value,
      podEnabled: payment_on_delivery?.enabled || false,
      podAmount: payment_on_delivery?.amount,
      podCurrency: payment_on_delivery?.currency || 'KES',
      metadata: { pickup, delivery, package: pkg, payment_on_delivery },
    });

    logger.info('Dispatch created via API', { orderId: order_reference });

    // Return response in Postman collection format
    return res.status(201).json({
      ok: true,
      dispatch_id: dispatch.id,
      status: dispatch.status.toLowerCase(),
      estimated_pickup: dispatch.estimatedPickup?.toISOString(),
      estimated_delivery: dispatch.estimatedDelivery?.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to create dispatch', { error: err });
    return res.status(500).json({ ok: false, error: 'Failed to create dispatch' });
  }
}

/**
 * POST /v1/dispatches/:dispatchId/cancel
 * Cancel a dispatch
 */
export async function cancelDispatchHandler(req: Request, res: Response) {
  try {
    const { dispatchId } = req.params;
    const { reason } = req.body;

    const dispatch = await cancelDispatch(dispatchId, reason);

    logger.info('Dispatch cancelled via API', { dispatchId });

    return res.status(200).json({
      ok: true,
      dispatch_id: dispatch.id,
      status: dispatch.status.toLowerCase(),
      cancelled_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to cancel dispatch', { error: err });
    return res.status(500).json({ ok: false, error: 'Failed to cancel dispatch' });
  }
}

/**
 * POST /webhooks/dispatch/easybox
 * Handle incoming webhook events from Easybox (dispatch status updates)
 */
export async function handleEasyboxWebhook(req: Request, res: Response) {
  try {
    const payload = req.body;

    if (!payload.event || !payload.data || !payload.data.order_reference) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid webhook payload: missing event, data, or order_reference',
      });
    }

    // Process webhook asynchronously
    const result = await handleDispatchWebhookEvent(payload);

    logger.info('Webhook processed successfully', {
      event: payload.event,
      orderId: payload.data.order_reference,
    });

    // Return 200 immediately
    return res.status(200).json({
      ok: true,
      event: payload.event,
      dispatch_id: result.id,
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Failed to process webhook', { error: err });
    return res.status(500).json({ ok: false, error: 'Webhook processing failed' });
  }
}
