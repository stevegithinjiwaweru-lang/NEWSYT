import { logger } from '../../../logger';
import { getZucchiniAdapter } from '../adapter/ZucchiniAdapter';
import { ZucchiniCustomer, CreateZucchiniCustomerRequest, ZucchiniApiResponse } from '../types';

/**
 * Zucchini Customer Service
 *
 * Handles customer operations: creation, updates, and synchronization
 */

export class ZucchiniCustomerService {
  private adapter = getZucchiniAdapter();

  /**
   * Get or create customer
   */
  async getOrCreateCustomer(phone: string, name: string, email?: string): Promise<ZucchiniCustomer> {
    try {
      logger.debug('Getting or creating customer', { phone });

      // Try to get existing customer
      try {
        const response = await this.adapter.getCustomer(phone);
        if (response.success && response.data) {
          return response.data;
        }
      } catch (error) {
        logger.debug('Customer not found, creating new', { phone });
      }

      // Create new customer
      const createResponse = await this.adapter.createCustomer({
        phone,
        name,
        email,
      });

      if (!createResponse.success || !createResponse.data) {
        throw new Error('Failed to create customer');
      }

      return createResponse.data;
    } catch (error) {
      logger.error('Failed to get or create customer', { phone, error });
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<CreateZucchiniCustomerRequest>
  ): Promise<ZucchiniApiResponse<ZucchiniCustomer>> {
    try {
      logger.debug('Updating customer', { customerId });

      const response = await this.adapter.updateCustomer(customerId, data);

      logger.info('Customer updated', { customerId });

      return response;
    } catch (error) {
      logger.error('Failed to update customer', { customerId, error });
      throw error;
    }
  }

  /**
   * Sync customers from Zucchini
   */
  async syncCustomers(): Promise<any> {
    try {
      logger.info('Syncing customers from Zucchini');

      const result = await this.adapter.syncCustomers();

      logger.info('Customer sync completed', { result });

      return result;
    } catch (error) {
      logger.error('Failed to sync customers', { error });
      throw error;
    }
  }
}

// Singleton
let customerService: ZucchiniCustomerService | null = null;

export function getZucchiniCustomerService(): ZucchiniCustomerService {
  if (!customerService) {
    customerService = new ZucchiniCustomerService();
  }
  return customerService;
}
