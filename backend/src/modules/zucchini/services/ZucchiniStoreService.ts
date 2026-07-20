import { logger } from '../../logger';
import { getZucchiniAdapter } from '../adapter/ZucchiniAdapter';
import { ZucchiniStore, ZucchiniQueryParams } from '../types';

/**
 * Zucchini Store Service
 *
 * Handles store and merchant operations
 */

export class ZucchiniStoreService {
  private adapter = getZucchiniAdapter();

  /**
   * Get store details
   */
  async getStore(storeId: string): Promise<ZucchiniStore> {
    try {
      logger.debug('Getting store', { storeId });

      const response = await this.adapter.getStore(storeId);

      if (!response.success || !response.data) {
        throw new Error('Store not found');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get store', { storeId, error });
      throw error;
    }
  }

  /**
   * List all stores
   */
  async listStores(params?: ZucchiniQueryParams) {
    try {
      logger.debug('Listing stores', { params });

      const response = await this.adapter.getStores(params);

      return response;
    } catch (error) {
      logger.error('Failed to list stores', { error });
      throw error;
    }
  }

  /**
   * Search stores
   */
  async searchStores(query: string) {
    try {
      logger.debug('Searching stores', { query });

      const response = await this.adapter.searchStores(query);

      return response;
    } catch (error) {
      logger.error('Failed to search stores', { query, error });
      throw error;
    }
  }

  /**
   * Get store menu
   */
  async getStoreMenu(storeId: string) {
    try {
      logger.debug('Getting store menu', { storeId });

      const response = await this.adapter.getMenu(storeId);

      if (!response.success) {
        throw new Error('Failed to get menu');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get store menu', { storeId, error });
      throw error;
    }
  }
}

// Singleton
let storeService: ZucchiniStoreService | null = null;

export function getZucchiniStoreService(): ZucchiniStoreService {
  if (!storeService) {
    storeService = new ZucchiniStoreService();
  }
  return storeService;
}
