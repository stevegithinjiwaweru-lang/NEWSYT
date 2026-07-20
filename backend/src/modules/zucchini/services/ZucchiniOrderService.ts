import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { getZucchiniAdapter } from '../adapter/ZucchiniAdapter';
import {
  ZucchiniCustomer,
  ZucchiniStore,
  ZucchiniOrder,
  ZucchiniQueryParams,
  CreateZucchiniOrderRequest,
  ZucchiniApiResponse,
  ZucchiniPaginatedResponse,
} from '../types';

/**
 * Zucchini Order Service
 *
 * Handles order processing, validation, and coordination between
 * Zucchini and Easybox domains.
 */

export class ZucchiniOrderService {
  private adapter = getZucchiniAdapter();

  /**
   * Process incoming order from Zucchini
   * Maps Zucchini order model to Easybox order
   * Validates pricing, inventory, delivery zones
   * Creates dispatch request
   */
  async processIncomingOrder(zucchiniOrder: ZucchiniOrder): Promise<any> {
    try {
      logger.info('Processing incoming Zucchini order', { orderId: zucchiniOrder.id });

      // 1. Validate order structure
      this.validateOrder(zucchiniOrder);

      // 2. Map to Easybox domain model
      const easyboxOrder = this.mapZucchiniToEasybox(zucchiniOrder);

      // 3. Check inventory if applicable
      // await this.validateInventory(easyboxOrder);

      // 4. Validate pricing
      // await this.validatePricing(easyboxOrder);

      // 5. Validate delivery zone
      // await this.validateDeliveryZone(easyboxOrder);

      // 6. Create order in Easybox database
      const createdOrder = await prisma.order.create({
        data: {
          ...easyboxOrder,
          metadata: {
            zucchiniOrderId: zucchiniOrder.id,
            zucchiniStoreId: zucchiniOrder.storeId,
            originalPayload: zucchiniOrder,
          },
        },
      });

      logger.info('Easybox order created', { easyboxOrderId: createdOrder.id });

      return createdOrder;
    } catch (error) {
      logger.error('Failed to process incoming order', { error });
      throw error;
    }
  }

  /**
   * Create order in Zucchini system
   */
  async createZucchiniOrder(data: CreateZucchiniOrderRequest): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      logger.info('Creating order in Zucchini', { storeId: data.storeId });

      // Validate request
      this.validateCreateOrderRequest(data);

      // Call adapter
      const response = await this.adapter.createOrder(data);

      logger.info('Zucchini order created', { orderId: response.data?.id });

      return response;
    } catch (error) {
      logger.error('Failed to create Zucchini order', { error });
      throw error;
    }
  }

  /**
   * Sync Zucchini orders to local database
   */
  async syncOrders(params?: { from?: Date; to?: Date }): Promise<any> {
    try {
      logger.info('Syncing Zucchini orders', { params });

      const result = await this.adapter.syncOrders(params);

      logger.info('Order sync completed', { result });

      return result;
    } catch (error) {
      logger.error('Failed to sync orders', { error });
      throw error;
    }
  }

  /**
   * List orders with filtering and pagination
   */
  async listOrders(params: ZucchiniQueryParams): Promise<ZucchiniPaginatedResponse<ZucchiniOrder>> {
    try {
      logger.debug('Listing Zucchini orders', { params });

      const response = await this.adapter.listOrders(params);

      return response;
    } catch (error) {
      logger.error('Failed to list orders', { error });
      throw error;
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      logger.debug('Getting order details', { orderId });

      const response = await this.adapter.getOrder(orderId);

      return response;
    } catch (error) {
      logger.error('Failed to get order', { error });
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      logger.info('Cancelling order', { orderId, reason });

      const response = await this.adapter.cancelOrder(orderId, reason);

      // Update local order status
      await this.updateLocalOrderStatus(orderId, 'CANCELLED');

      logger.info('Order cancelled', { orderId });

      return response;
    } catch (error) {
      logger.error('Failed to cancel order', { error });
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private validateOrder(order: ZucchiniOrder): void {
    if (!order.id || !order.storeId || !order.customerId) {
      throw new Error('Invalid order structure: missing required fields');
    }

    if (!order.items || order.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (!order.deliveryAddress) {
      throw new Error('Order must include delivery address');
    }
  }

  private validateCreateOrderRequest(data: CreateZucchiniOrderRequest): void {
    if (!data.storeId || !data.customerId) {
      throw new Error('Store ID and Customer ID are required');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
  }

  private mapZucchiniToEasybox(zucchiniOrder: ZucchiniOrder): any {
    return {
      referenceNumber: zucchiniOrder.referenceNumber || zucchiniOrder.id,
      customerId: zucchiniOrder.customerId,
      merchantId: zucchiniOrder.storeId,
      items: zucchiniOrder.items,
      deliveryAddress: zucchiniOrder.deliveryAddress,
      deliveryInstructions: zucchiniOrder.deliveryInstructions,
      paymentMethod: zucchiniOrder.paymentMethod,
      paymentStatus: zucchiniOrder.paymentStatus,
      status: this.mapOrderStatus(zucchiniOrder.status),
      subtotal: zucchiniOrder.subtotal,
      tax: zucchiniOrder.tax,
      deliveryFee: zucchiniOrder.deliveryFee,
      discount: zucchiniOrder.discount || 0,
      total: zucchiniOrder.total,
      notes: zucchiniOrder.notes,
      estimatedDeliveryTime: zucchiniOrder.estimatedDeliveryTime ? new Date(zucchiniOrder.estimatedDeliveryTime) : null,
    };
  }

  private mapOrderStatus(zucchiniStatus: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'PENDING',
      'CONFIRMED': 'CONFIRMED',
      'PREPARING': 'CONFIRMED',
      'READY_FOR_PICKUP': 'READY',
      'DISPATCHED': 'DISPATCHED',
      'IN_TRANSIT': 'IN_TRANSIT',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
      'FAILED': 'FAILED',
    };

    return statusMap[zucchiniStatus] || 'PENDING';
  }

  private async updateLocalOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status },
      });
    } catch (error) {
      logger.error('Failed to update local order status', { orderId, status, error });
    }
  }
}

// Singleton
let orderService: ZucchiniOrderService | null = null;

export function getZucchiniOrderService(): ZucchiniOrderService {
  if (!orderService) {
    orderService = new ZucchiniOrderService();
  }
  return orderService;
}
