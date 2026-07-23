import { prisma } from '../prisma';
import { logger } from '../logger';
import { DispatchStatus, OrderStatus, Prisma } from '@prisma/client';

const TERMINAL_DISPATCH_STATUSES: DispatchStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED'];

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
 * `riderId` here is trusted to reference a real, internally-managed Rider
 * (this is the internal-dashboard path), so it's safe to couple capacity:
 * the rider must be AVAILABLE, and reassigning frees the previous rider.
 */
export async function assignDispatch(dispatchId: string, riderId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.findUnique({ where: { id: dispatchId } });
      if (!dispatch) throw new Error('Dispatch not found');
      if (TERMINAL_DISPATCH_STATUSES.includes(dispatch.status)) {
        throw new Error('Dispatch is already completed and cannot be reassigned');
      }
      if (dispatch.riderId === riderId) {
        return dispatch;
      }

      const rider = await tx.rider.findUnique({ where: { id: riderId } });
      if (!rider) throw new Error('Rider not found');

      const riderGuard = await tx.rider.updateMany({
        where: { id: riderId, status: 'AVAILABLE' },
        data: { status: 'BUSY' },
      });
      if (riderGuard.count === 0) throw new Error('Rider is not available');

      const dispatchGuard = await tx.dispatch.updateMany({
        where: { id: dispatchId, status: { notIn: TERMINAL_DISPATCH_STATUSES } },
        data: { riderId, status: 'ASSIGNED' },
      });
      if (dispatchGuard.count === 0) {
        throw new Error('Dispatch has already been assigned or is no longer available');
      }

      if (dispatch.riderId && dispatch.riderId !== riderId) {
        // Reassignment: free the previously-assigned rider.
        await tx.rider.update({ where: { id: dispatch.riderId }, data: { status: 'AVAILABLE' } });
      }

      return tx.dispatch.findUnique({
        where: { id: dispatchId },
        include: { rider: true, order: true },
      });
    });

    logger.info('Dispatch assigned', { dispatchId, riderId });
    return result;
  } catch (err) {
    logger.error('Failed to assign dispatch', { dispatchId, error: err });
    throw err;
  }
}

/**
 * Cancel a dispatch. Idempotent if already cancelled; rejects if already
 * delivered/failed. Frees the assigned rider (if any) back to AVAILABLE.
 */
export async function cancelDispatch(dispatchId: string, reason?: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.findUnique({ where: { id: dispatchId } });
      if (!dispatch) throw new Error('Dispatch not found');

      if (dispatch.status === 'CANCELLED') {
        return dispatch;
      }
      if (dispatch.status === 'DELIVERED' || dispatch.status === 'FAILED') {
        throw new Error('Dispatch is already completed and cannot be cancelled');
      }

      const updated = await tx.dispatch.update({
        where: { id: dispatchId },
        data: { status: 'CANCELLED', cancellationReason: reason },
        include: { rider: true, order: true },
      });

      if (dispatch.riderId) {
        await tx.rider.updateMany({
          where: { id: dispatch.riderId, status: 'BUSY' },
          data: { status: 'AVAILABLE' },
        });
      }

      return updated;
    });

    logger.info('Dispatch cancelled', { dispatchId, reason });
    return result;
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
 * Applies every field change (easyboxId, status, rider, location, POD) as a
 * single update within one transaction, alongside the DispatchEvent log entry
 * and the linked Order's status update — atomic, and avoids the divergent
 * partial-`include` reassignments the previous version had.
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

    const newStatus = mapEasyboxStatusToDispatchStatus(status);

    const result = await prisma.$transaction(async (tx) => {
      let dispatch = await tx.dispatch.findUnique({ where: { orderReference: order_reference } });

      if (!dispatch) {
        logger.warn('Dispatch not found for webhook', { order_reference });
        dispatch = await tx.dispatch.create({
          data: { orderReference: order_reference, status: 'PENDING' },
        });
      }

      const updateData: Prisma.DispatchUpdateInput = { status: newStatus };

      if (dispatch_id && !dispatch.easyboxId) {
        updateData.easyboxId = dispatch_id;
      }
      if (delivered_at) {
        updateData.actualDeliveryAt = new Date(delivered_at);
      }
      if (failure_reason) {
        updateData.failureReason = failure_reason;
      }
      if (location) {
        updateData.deliveryLat = location.latitude;
        updateData.deliveryLng = location.longitude;
      }
      if (event === 'dispatch.delivered' && data.metadata?.pod_collected) {
        updateData.podCollected = true;
        updateData.podMethod = data.metadata.pod_method;
        updateData.podReference = data.metadata.pod_reference;
      }

      // Rider handling: upsert Easybox's rider record, but only couple
      // RiderStatus capacity transitions for riders that already existed in
      // our roster before this call — a rider freshly created here is a
      // phantom row Easybox mentioned, never one we scheduled capacity for.
      let riderId = dispatch.riderId;
      if (rider) {
        const existingRider = await tx.rider.findUnique({ where: { id: rider.id } });

        const riderRecord = await tx.rider.upsert({
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

        if (!dispatch.riderId) {
          riderId = riderRecord.id;
          updateData.rider = { connect: { id: riderRecord.id } };
        }

        if (existingRider && !dispatch.riderId) {
          await tx.rider.updateMany({
            where: { id: riderRecord.id, status: 'AVAILABLE' },
            data: { status: 'BUSY' },
          });
        }
      }

      if (riderId && TERMINAL_DISPATCH_STATUSES.includes(newStatus)) {
        const existingRider = await tx.rider.findUnique({ where: { id: riderId } });
        if (existingRider) {
          await tx.rider.updateMany({
            where: { id: riderId, status: 'BUSY' },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      const updated = await tx.dispatch.update({
        where: { id: dispatch.id },
        data: updateData,
        include: { rider: true, order: true, events: { orderBy: { createdAt: 'desc' } } },
      });

      await tx.dispatchEvent.create({
        data: {
          dispatchId: updated.id,
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

      if (updated.orderId) {
        await updateOrderStatusFromDispatch(tx, updated.orderId, newStatus);
      }

      return updated;
    });

    logger.info('Dispatch webhook event processed', { dispatchId: result.id, event });
    return result;
  } catch (err) {
    logger.error('Failed to handle dispatch webhook event', { error: err });
    throw err;
  }
}

/**
 * Map Easybox status strings to DispatchStatus enum.
 * Rejects unrecognized input rather than silently defaulting to PENDING,
 * which would otherwise regress an in-flight dispatch on a bad payload.
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
  const mapped = mapping[easyboxStatus?.toUpperCase()];
  if (!mapped) {
    throw new Error(`Unrecognized Easybox status: ${easyboxStatus}`);
  }
  return mapped;
}

// DispatchStatus -> OrderStatus. CANCELLED intentionally has no entry: order
// status is left untouched on dispatch cancellation, since Zucchini/Easybox
// may issue a new dispatch for the same order.
const DISPATCH_TO_ORDER_STATUS: Partial<Record<DispatchStatus, OrderStatus>> = {
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  EN_ROUTE: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
};

/**
 * Update Order status based on Dispatch status, within the caller's transaction.
 */
async function updateOrderStatusFromDispatch(
  tx: Prisma.TransactionClient,
  orderId: string,
  dispatchStatus: DispatchStatus
) {
  const newOrderStatus = DISPATCH_TO_ORDER_STATUS[dispatchStatus];
  if (!newOrderStatus) return;

  await tx.order.update({
    where: { id: orderId },
    data: { status: newOrderStatus },
  });
  logger.info('Order status updated from dispatch', { orderId, status: newOrderStatus });
}
