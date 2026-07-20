import { prisma } from '../prisma';
import { logger } from '../logger';
import { DispatchStatus } from '@prisma/client';

/**
 * Create a new dispatch record.
 * Used when Zucchini calls the Easybox API to create a dispatch.
 */
export async function createDispatch(data: {
  orderReference: string;
  orderId?: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  estimatedPickup?: Date;
  estimatedDelivery?: Date;
  packageDescription?: string;
  packageWeight?: number;
  packageValue?: number;
  podEnabled?: boolean;
  podAmount?: number;
  podCurrency?: string;
  metadata?: any;
}) {
  try {
    const dispatch = await prisma.dispatch.create({
      data: {
        orderReference: data.orderReference,
        orderId: data.orderId,
        status: 'PENDING',
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        deliveryLat: data.deliveryLat,
        deliveryLng: data.deliveryLng,
        estimatedPickup: data.estimatedPickup,
        estimatedDelivery: data.estimatedDelivery,
        packageDescription: data.packageDescription,
        packageWeight: data.packageWeight,
        packageValue: data.packageValue,
        podEnabled: data.podEnabled || false,
        podAmount: data.podAmount,
        podCurrency: data.podCurrency || 'KES',
        metadata: data.metadata,
      },
      include: { rider: true, order: true },
    });
    logger.info('Dispatch created', { id: dispatch.id, orderReference: data.orderReference });
    return dispatch;
  } catch (err) {
    logger.error('Failed to create dispatch', { error: err });
    throw err;
  }
}

/**
 * Assign a rider to a dispatch.
 */
export async function assignDispatch(dispatchId: string, riderId: string) {
  try {
    const dispatch = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        riderId,
        status: 'ASSIGNED',
      },
      include: { rider: true, order: true },
    });
    logger.info('Dispatch assigned', { dispatchId, riderId });
    return dispatch;
  } catch (err) {
    logger.error('Failed to assign dispatch', { dispatchId, error: err });
    throw err;
  }
}

/**
 * Cancel a dispatch.
 */
export async function cancelDispatch(dispatchId: string, reason?: string) {
  try {
    const dispatch = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
      },
      include: { rider: true, order: true },
    });
    logger.info('Dispatch cancelled', { dispatchId, reason });
    return dispatch;
  } catch (err) {
    logger.error('Failed to cancel dispatch', { dispatchId, error: err });
    throw err;
  }
}

/**
 * Get a dispatch by ID.
 */
export async function getDispatch(id: string) {
  try {
    return await prisma.dispatch.findUnique({
      where: { id },
      include: { rider: true, order: true, events: { orderBy: { createdAt: 'desc' } } },
    });
  } catch (err) {
    logger.error('Failed to fetch dispatch', { id, error: err });
    throw err;
  }
}

/**
 * Get a dispatch by Easybox ID.
 */
export async function getDispatchByEasyboxId(easyboxId: string) {
  try {
    return await prisma.dispatch.findUnique({
      where: { easyboxId },
      include: { rider: true, order: true, events: { orderBy: { createdAt: 'desc' } } },
    });
  } catch (err) {
    logger.error('Failed to fetch dispatch by easyboxId', { easyboxId, error: err });
    throw err;
  }
}

/**
 * Get a dispatch by order reference.
 */
export async function getDispatchByOrderReference(orderReference: string) {
  try {
    return await prisma.dispatch.findUnique({
      where: { orderReference },
      include: { rider: true, order: true, events: { orderBy: { createdAt: 'desc' } } },
    });
  } catch (err) {
    logger.error('Failed to fetch dispatch by orderReference', { orderReference, error: err });
    throw err;
  }
}

/**
 * List all dispatches.
 */
export async function listDispatches() {
  try {
    return await prisma.dispatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { rider: true, order: true },
    });
  } catch (err) {
    logger.error('Failed to list dispatches', { error: err });
    throw err;
  }
}

/**
 * Handle incoming webhook event from Easybox.
 * Creates dispatch event record and updates dispatch status.
 */
export async function handleDispatchWebhookEvent(payload: {
  event: string;
  timestamp: string;
  data: {
    dispatch_id: string;
    order_reference: string;
    status: string;
    rider?: { id: string; name: string; phone: string; vehicle_type?: string; vehicle_plate?: string };
    location?: { latitude: number; longitude: number; accuracy: number; timestamp: string };
    delivered_at?: string;
    failure_reason?: string;
    estimated_delivery?: string;
    metadata?: any;
  };
}) {
  try {
    const { event, data } = payload;
    const { dispatch_id, order_reference, status, rider, location, delivered_at, failure_reason } = data;

    let dispatch = await getDispatchByOrderReference(order_reference);

    if (!dispatch) {
      logger.warn('Dispatch not found for webhook', { order_reference });
      // Create new dispatch if it doesn't exist (fallback)
      dispatch = await createDispatch({
        orderReference: order_reference,
      });
    }

    // Update dispatch Easybox ID if provided
    if (dispatch_id && !dispatch.easyboxId) {
      dispatch = await prisma.dispatch.update({
        where: { id: dispatch.id },
        data: { easyboxId: dispatch_id },
        include: { rider: true, order: true },
      });
    }

    // Update dispatch status
    const newStatus = mapEasyboxStatusToDispatchStatus(status);
    dispatch = await prisma.dispatch.update({
      where: { id: dispatch.id },
      data: {
        status: newStatus,
        actualDeliveryAt: delivered_at ? new Date(delivered_at) : undefined,
        failureReason: failure_reason,
      },
      include: { rider: true, order: true },
    });

    // Handle rider assignment/update
    if (rider) {
      const riderRecord = await prisma.rider.upsert({
        where: { id: rider.id },
        update: {
          name: rider.name,
          phone: rider.phone,
          vehicleType: rider.vehicle_type,
          vehiclePlate: rider.vehicle_plate,
        },
        create: {
          id: rider.id,
          name: rider.name,
          phone: rider.phone,
          vehicleType: rider.vehicle_type,
          vehiclePlate: rider.vehicle_plate,
        },
      });

      // Assign rider to dispatch if not already assigned
      if (!dispatch.riderId) {
        dispatch = await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { riderId: riderRecord.id },
          include: { rider: true, order: true },
        });
      }
    }

    // Update location if provided
    if (location) {
      dispatch = await prisma.dispatch.update({
        where: { id: dispatch.id },
        data: {
          deliveryLat: location.latitude,
          deliveryLng: location.longitude,
        },
        include: { rider: true, order: true },
      });
    }

    // Create event log entry
    await prisma.dispatchEvent.create({
      data: {
        dispatchId: dispatch.id,
        event,
        status: newStatus,
        lat: location?.latitude,
        lng: location?.longitude,
        accuracy: location?.accuracy,
        reason: failure_reason,
        riderName: rider?.name,
        riderPhone: rider?.phone,
        eventTimestamp: new Date(payload.timestamp),
      },
    });

    // Handle order status updates
    if (dispatch.orderId) {
      await updateOrderStatusFromDispatch(dispatch);
    }

    // Handle payment on delivery collection
    if (event === 'dispatch.delivered' && data.metadata?.pod_collected) {
      dispatch = await prisma.dispatch.update({
        where: { id: dispatch.id },
        data: {
          podCollected: true,
          podMethod: data.metadata.pod_method,
          podReference: data.metadata.pod_reference,
        },
        include: { rider: true, order: true },
      });
    }

    logger.info('Dispatch webhook event processed', { dispatchId: dispatch.id, event });
    return dispatch;
  } catch (err) {
    logger.error('Failed to handle dispatch webhook event', { error: err });
    throw err;
  }
}

/**
 * Map Easybox status strings to DispatchStatus enum.
 */
function mapEasyboxStatusToDispatchStatus(easyboxStatus: string): DispatchStatus {
  const mapping: { [key: string]: DispatchStatus } = {
    'CREATED': 'CREATED',
    'ASSIGNED': 'ASSIGNED',
    'PICKED_UP': 'PICKED_UP',
    'EN_ROUTE': 'EN_ROUTE',
    'ARRIVED': 'ARRIVED',
    'DELIVERED': 'DELIVERED',
    'FAILED': 'FAILED',
    'CANCELLED': 'CANCELLED',
  };
  return mapping[easyboxStatus] || 'PENDING';
}

/**
 * Update Order status based on Dispatch status.
 */
async function updateOrderStatusFromDispatch(dispatch: any) {
  if (!dispatch.orderId) return;

  const statusMapping: { [key: string]: string } = {
    'ASSIGNED': 'ASSIGNED',
    'PICKED_UP': 'PICKED_UP',
    'EN_ROUTE': 'IN_TRANSIT',
    'DELIVERED': 'DELIVERED',
    'FAILED': 'FAILED',
  };

  const newOrderStatus = statusMapping[dispatch.status];
  if (newOrderStatus) {
    await prisma.order.update({
      where: { id: dispatch.orderId },
      data: { status: newOrderStatus },
    });
    logger.info('Order status updated from dispatch', { orderId: dispatch.orderId, status: newOrderStatus });
  }
}
