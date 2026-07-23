import { logger } from '../../../logger';
import { getZucchiniAdapter } from '../adapter/ZucchiniAdapter';
import { CreateZucchiniOrderRequest, ZucchiniApiResponse } from '../types';

/**
 * Zucchini Pricing Service
 *
 * Handles pricing calculations, discounts, promos, and delivery fees
 */

export class ZucchiniPricingService {
  private adapter = getZucchiniAdapter();

  /**
   * Calculate order totals
   */
  async calculateOrderTotals(data: CreateZucchiniOrderRequest): Promise<any> {
    try {
      logger.debug('Calculating order totals', { storeId: data.storeId });

      const response = await this.adapter.calculateOrderTotals(data);

      if (!response.success) {
        throw new Error('Failed to calculate totals');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to calculate order totals', { error });
      throw error;
    }
  }

  /**
   * Get delivery fee for address
   */
  async getDeliveryFee(storeId: string, deliveryAddress: any): Promise<{ fee: number; estimatedTime: number }> {
    try {
      logger.debug('Getting delivery fee', { storeId });

      const response = await this.adapter.getDeliveryFee(storeId, deliveryAddress);

      if (!response.success || !response.data) {
        throw new Error('Failed to get delivery fee');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get delivery fee', { error });
      throw error;
    }
  }

  /**
   * Validate and apply promo code
   */
  async validatePromoCode(
    code: string,
    storeId: string,
    orderTotal?: number
  ): Promise<{ valid: boolean; discount: number }> {
    try {
      logger.debug('Validating promo code', { code, storeId });

      const response = await this.adapter.validatePromoCode(code, storeId, orderTotal);

      if (!response.success || !response.data) {
        return { valid: false, discount: 0 };
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to validate promo code', { code, error });
      return { valid: false, discount: 0 };
    }
  }
}

// Singleton
let pricingService: ZucchiniPricingService | null = null;

export function getZucchiniPricingService(): ZucchiniPricingService {
  if (!pricingService) {
    pricingService = new ZucchiniPricingService();
  }
  return pricingService;
}
