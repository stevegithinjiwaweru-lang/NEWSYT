import { logger } from '../../logger';
import { getZucchiniAdapter } from '../adapter/ZucchiniAdapter';

/**
 * Zucchini Payment Service
 *
 * Handles payment operations: confirmations, refunds, and reconciliation
 */

export class ZucchiniPaymentService {
  private adapter = getZucchiniAdapter();

  /**
   * Get payment details
   */
  async getPayment(orderId: string) {
    try {
      logger.debug('Getting payment', { orderId });

      const response = await this.adapter.getPayment(orderId);

      if (!response.success) {
        throw new Error('Failed to get payment');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get payment', { orderId, error });
      throw error;
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(orderId: string, transactionId: string) {
    try {
      logger.info('Confirming payment', { orderId, transactionId });

      const response = await this.adapter.confirmPayment(orderId, transactionId);

      if (!response.success) {
        throw new Error('Failed to confirm payment');
      }

      logger.info('Payment confirmed', { orderId });

      return response.data;
    } catch (error) {
      logger.error('Failed to confirm payment', { orderId, error });
      throw error;
    }
  }

  /**
   * Process refund
   */
  async refundPayment(orderId: string, amount?: number) {
    try {
      logger.info('Processing refund', { orderId, amount });

      const response = await this.adapter.refundPayment(orderId, amount);

      if (!response.success) {
        throw new Error('Failed to process refund');
      }

      logger.info('Refund processed', { orderId });

      return response.data;
    } catch (error) {
      logger.error('Failed to process refund', { orderId, error });
      throw error;
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(): Promise<string[]> {
    try {
      logger.debug('Getting payment methods');

      const response = await this.adapter.getPaymentMethods();

      if (!response.success || !response.data) {
        return [];
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get payment methods', { error });
      return [];
    }
  }
}

// Singleton
let paymentService: ZucchiniPaymentService | null = null;

export function getZucchiniPaymentService(): ZucchiniPaymentService {
  if (!paymentService) {
    paymentService = new ZucchiniPaymentService();
  }
  return paymentService;
}
