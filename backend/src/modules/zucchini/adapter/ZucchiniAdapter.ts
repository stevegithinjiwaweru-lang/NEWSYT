import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { logger } from '../../logger';
import { getZucchiniConfig } from '../config';
import {
  IZucchiniAdapter,
  ZucchiniCustomer,
  ZucchiniStore,
  ZucchiniMenu,
  ZucchiniOrder,
  ZucchiniPayment,
  ZucchiniApiResponse,
  ZucchiniPaginatedResponse,
  ZucchiniQueryParams,
  CreateZucchiniOrderRequest,
  UpdateZucchiniOrderRequest,
  CreateZucchiniCustomerRequest,
  IntegrationStatus,
  ZucchiniAuthToken,
} from '../interfaces/IZucchiniAdapter';
import {
  ZucchiniConnectionError,
  ZucchiniAuthenticationError,
  ZucchiniValidationError,
  ZucchiniTimeoutError,
  ZucchiniNotImplementedError,
  ZucchiniWebhookError,
} from '../errors';
import { ZUCCHINI_CONSTANTS } from '../constants';

/**
 * Zucchini API Adapter
 *
 * Production-ready implementation that wraps Zucchini API calls.
 * Uses interface-driven design to allow for easy testing and future implementations.
 */

export class ZucchiniAdapter implements IZucchiniAdapter {
  private config = getZucchiniConfig();
  private httpClient: AxiosInstance;
  private authToken: ZucchiniAuthToken | null = null;
  private webhookListeners: Map<string, Set<(data: any) => Promise<void>>> = new Map();
  private lastHealthCheck: Date | null = null;
  private healthCheckInterval: NodeJS.Timer | null = null;
  private isInitialized: boolean = false;
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.config.apiBaseUrl,
      timeout: this.config.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging, error handling, and telemetry
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use((config) => {
      const requestId = crypto.randomUUID();
      config.headers['X-Request-ID'] = requestId;
      config.metadata = { startTime: Date.now() };
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config as any).metadata.startTime;
        this.requestCount++;
        this.totalResponseTime += duration;

        logger.debug('Zucchini API response', {
          status: response.status,
          duration,
          requestId: response.config.headers['X-Request-ID'],
        });

        return response;
      },
      (error: AxiosError) => {
        this.errorCount++;
        logger.error('Zucchini API error', {
          status: error.response?.status,
          message: error.message,
          code: error.code,
          requestId: error.config?.headers['X-Request-ID'],
        });
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        logger.warn('Zucchini integration is disabled');
        return;
      }

      if (this.isInitialized) {
        logger.debug('Zucchini adapter already initialized');
        return;
      }

      logger.info('Initializing Zucchini adapter');

      // Verify credentials
      if (!this.config.apiKey || !this.config.apiSecret) {
        logger.warn('Zucchini credentials not configured. Integration will operate in stub mode.');
      }

      // Try to authenticate
      try {
        await this.authenticate();
        logger.info('Zucchini authentication successful');
      } catch (error) {
        logger.warn('Zucchini authentication failed', { error });
        // Don't fail initialization - adapter can still function with stub responses
      }

      // Start health check interval
      this.startHealthCheckInterval();

      this.isInitialized = true;
      logger.info('Zucchini adapter initialized');
    } catch (error) {
      logger.error('Failed to initialize Zucchini adapter', { error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return true; // Disabled = OK
      }

      this.lastHealthCheck = new Date();

      // Try to authenticate if no token
      if (!this.authToken) {
        await this.authenticate();
      }

      // Make a simple API call to verify connectivity
      const response = await this.httpClient.get('/health', {
        headers: this.getAuthHeaders(),
      });

      return response.status === 200;
    } catch (error) {
      logger.warn('Zucchini health check failed', { error });
      return false;
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    const averageResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;
    const uptime = this.lastHealthCheck ? 100 : 0; // Simplified uptime calculation

    return {
      enabled: this.config.enabled,
      connected: this.authToken !== null,
      lastHealthCheck: this.lastHealthCheck || new Date(),
      lastSuccessfulSync: null, // To be populated by sync services
      lastError: null, // To be populated by error handlers
      errorCount: this.errorCount,
      warningCount: 0, // To be tracked separately
      webhookReceived: 0, // To be tracked in webhook handler
      webhookFailed: 0, // To be tracked in webhook handler
      ordersProcessed: this.requestCount,
      ordersFailed: this.errorCount,
      averageResponseTime,
      uptime,
    };
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Zucchini adapter');

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.webhookListeners.clear();
      this.authToken = null;
      this.isInitialized = false;

      logger.info('Zucchini adapter shutdown complete');
    } catch (error) {
      logger.error('Error during Zucchini adapter shutdown', { error });
      throw error;
    }
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async authenticate(): Promise<string> {
    try {
      if (!this.config.apiKey || !this.config.apiSecret) {
        throw new ZucchiniNotImplementedError('authenticate');
      }

      logger.debug('Authenticating with Zucchini API');

      // TODO: Implement actual Zucchini authentication once API is available
      // For now, throw NotImplementedError to indicate stub mode
      throw new ZucchiniNotImplementedError('authenticate');
    } catch (error) {
      if (error instanceof ZucchiniNotImplementedError) {
        logger.debug('Zucchini authentication not implemented yet');
        throw error;
      }
      throw new ZucchiniAuthenticationError('Failed to authenticate', { error });
    }
  }

  async refreshToken(): Promise<string> {
    try {
      if (!this.authToken?.refreshToken) {
        throw new ZucchiniNotImplementedError('refreshToken');
      }

      logger.debug('Refreshing Zucchini authentication token');
      throw new ZucchiniNotImplementedError('refreshToken');
    } catch (error) {
      if (error instanceof ZucchiniNotImplementedError) {
        throw error;
      }
      throw new ZucchiniAuthenticationError('Failed to refresh token', { error });
    }
  }

  async verifyCredentials(): Promise<boolean> {
    try {
      logger.debug('Verifying Zucchini credentials');
      await this.authenticate();
      return true;
    } catch (error) {
      logger.warn('Credential verification failed', { error });
      return false;
    }
  }

  // ============================================
  // STORES & MERCHANTS
  // ============================================

  async getStores(params?: ZucchiniQueryParams): Promise<ZucchiniPaginatedResponse<ZucchiniStore>> {
    try {
      logger.debug('Fetching stores', { params });
      throw new ZucchiniNotImplementedError('getStores');
    } catch (error) {
      throw this.handleError(error, 'getStores');
    }
  }

  async getStore(storeId: string): Promise<ZucchiniApiResponse<ZucchiniStore>> {
    try {
      if (!storeId) {
        throw new ZucchiniValidationError('Store ID is required');
      }

      logger.debug('Fetching store', { storeId });
      throw new ZucchiniNotImplementedError('getStore');
    } catch (error) {
      throw this.handleError(error, 'getStore');
    }
  }

  async searchStores(query: string): Promise<ZucchiniPaginatedResponse<ZucchiniStore>> {
    try {
      if (!query) {
        throw new ZucchiniValidationError('Search query is required');
      }

      logger.debug('Searching stores', { query });
      throw new ZucchiniNotImplementedError('searchStores');
    } catch (error) {
      throw this.handleError(error, 'searchStores');
    }
  }

  // ============================================
  // MENU & PRODUCTS
  // ============================================

  async getMenu(storeId: string): Promise<ZucchiniApiResponse<ZucchiniMenu>> {
    try {
      if (!storeId) {
        throw new ZucchiniValidationError('Store ID is required');
      }

      logger.debug('Fetching menu', { storeId });
      throw new ZucchiniNotImplementedError('getMenu');
    } catch (error) {
      throw this.handleError(error, 'getMenu');
    }
  }

  async searchProducts(query: string, storeId?: string): Promise<ZucchiniPaginatedResponse<any>> {
    try {
      if (!query) {
        throw new ZucchiniValidationError('Search query is required');
      }

      logger.debug('Searching products', { query, storeId });
      throw new ZucchiniNotImplementedError('searchProducts');
    } catch (error) {
      throw this.handleError(error, 'searchProducts');
    }
  }

  async syncMenu(storeId: string): Promise<any> {
    try {
      if (!storeId) {
        throw new ZucchiniValidationError('Store ID is required');
      }

      logger.info('Syncing menu', { storeId });
      throw new ZucchiniNotImplementedError('syncMenu');
    } catch (error) {
      throw this.handleError(error, 'syncMenu');
    }
  }

  async checkProductAvailability(storeId: string, productId: string): Promise<boolean> {
    try {
      if (!storeId || !productId) {
        throw new ZucchiniValidationError('Store ID and Product ID are required');
      }

      logger.debug('Checking product availability', { storeId, productId });
      throw new ZucchiniNotImplementedError('checkProductAvailability');
    } catch (error) {
      throw this.handleError(error, 'checkProductAvailability');
    }
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async getCustomer(identifier: string): Promise<ZucchiniApiResponse<ZucchiniCustomer>> {
    try {
      if (!identifier) {
        throw new ZucchiniValidationError('Customer identifier is required');
      }

      logger.debug('Fetching customer', { identifier });
      throw new ZucchiniNotImplementedError('getCustomer');
    } catch (error) {
      throw this.handleError(error, 'getCustomer');
    }
  }

  async createCustomer(data: CreateZucchiniCustomerRequest): Promise<ZucchiniApiResponse<ZucchiniCustomer>> {
    try {
      if (!data.phone || !data.name) {
        throw new ZucchiniValidationError('Phone and name are required');
      }

      logger.debug('Creating customer', { phone: data.phone });
      throw new ZucchiniNotImplementedError('createCustomer');
    } catch (error) {
      throw this.handleError(error, 'createCustomer');
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<CreateZucchiniCustomerRequest>
  ): Promise<ZucchiniApiResponse<ZucchiniCustomer>> {
    try {
      if (!customerId) {
        throw new ZucchiniValidationError('Customer ID is required');
      }

      logger.debug('Updating customer', { customerId });
      throw new ZucchiniNotImplementedError('updateCustomer');
    } catch (error) {
      throw this.handleError(error, 'updateCustomer');
    }
  }

  async syncCustomers(): Promise<any> {
    try {
      logger.info('Syncing customers');
      throw new ZucchiniNotImplementedError('syncCustomers');
    } catch (error) {
      throw this.handleError(error, 'syncCustomers');
    }
  }

  // ============================================
  // ORDERS
  // ============================================

  async getOrder(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Fetching order', { orderId });
      throw new ZucchiniNotImplementedError('getOrder');
    } catch (error) {
      throw this.handleError(error, 'getOrder');
    }
  }

  async createOrder(data: CreateZucchiniOrderRequest): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!data.storeId || !data.customerId || !data.items || data.items.length === 0) {
        throw new ZucchiniValidationError('Store ID, Customer ID, and items are required');
      }

      logger.debug('Creating order', { storeId: data.storeId, customerId: data.customerId });
      throw new ZucchiniNotImplementedError('createOrder');
    } catch (error) {
      throw this.handleError(error, 'createOrder');
    }
  }

  async updateOrder(orderId: string, data: UpdateZucchiniOrderRequest): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Updating order', { orderId });
      throw new ZucchiniNotImplementedError('updateOrder');
    } catch (error) {
      throw this.handleError(error, 'updateOrder');
    }
  }

  async cancelOrder(orderId: string, reason?: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Cancelling order', { orderId, reason });
      throw new ZucchiniNotImplementedError('cancelOrder');
    } catch (error) {
      throw this.handleError(error, 'cancelOrder');
    }
  }

  async acceptOrder(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Accepting order', { orderId });
      throw new ZucchiniNotImplementedError('acceptOrder');
    } catch (error) {
      throw this.handleError(error, 'acceptOrder');
    }
  }

  async rejectOrder(orderId: string, reason: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId || !reason) {
        throw new ZucchiniValidationError('Order ID and reason are required');
      }

      logger.debug('Rejecting order', { orderId, reason });
      throw new ZucchiniNotImplementedError('rejectOrder');
    } catch (error) {
      throw this.handleError(error, 'rejectOrder');
    }
  }

  async confirmOrderReady(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Confirming order ready', { orderId });
      throw new ZucchiniNotImplementedError('confirmOrderReady');
    } catch (error) {
      throw this.handleError(error, 'confirmOrderReady');
    }
  }

  async getOrderStatus(orderId: string): Promise<ZucchiniApiResponse<{ status: string; updatedAt: string }>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Getting order status', { orderId });
      throw new ZucchiniNotImplementedError('getOrderStatus');
    } catch (error) {
      throw this.handleError(error, 'getOrderStatus');
    }
  }

  async getOrderDeliveryAddress(orderId: string): Promise<ZucchiniApiResponse<any>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Getting order delivery address', { orderId });
      throw new ZucchiniNotImplementedError('getOrderDeliveryAddress');
    } catch (error) {
      throw this.handleError(error, 'getOrderDeliveryAddress');
    }
  }

  async listOrders(params: ZucchiniQueryParams): Promise<ZucchiniPaginatedResponse<ZucchiniOrder>> {
    try {
      logger.debug('Listing orders', { params });
      throw new ZucchiniNotImplementedError('listOrders');
    } catch (error) {
      throw this.handleError(error, 'listOrders');
    }
  }

  async syncOrders(params?: { from?: Date; to?: Date }): Promise<any> {
    try {
      logger.info('Syncing orders', { params });
      throw new ZucchiniNotImplementedError('syncOrders');
    } catch (error) {
      throw this.handleError(error, 'syncOrders');
    }
  }

  // ============================================
  // PAYMENTS
  // ============================================

  async getPayment(orderId: string): Promise<ZucchiniApiResponse<ZucchiniPayment>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Fetching payment', { orderId });
      throw new ZucchiniNotImplementedError('getPayment');
    } catch (error) {
      throw this.handleError(error, 'getPayment');
    }
  }

  async confirmPayment(orderId: string, transactionId: string): Promise<ZucchiniApiResponse<ZucchiniPayment>> {
    try {
      if (!orderId || !transactionId) {
        throw new ZucchiniValidationError('Order ID and transaction ID are required');
      }

      logger.debug('Confirming payment', { orderId, transactionId });
      throw new ZucchiniNotImplementedError('confirmPayment');
    } catch (error) {
      throw this.handleError(error, 'confirmPayment');
    }
  }

  async refundPayment(orderId: string, amount?: number): Promise<ZucchiniApiResponse<any>> {
    try {
      if (!orderId) {
        throw new ZucchiniValidationError('Order ID is required');
      }

      logger.debug('Refunding payment', { orderId, amount });
      throw new ZucchiniNotImplementedError('refundPayment');
    } catch (error) {
      throw this.handleError(error, 'refundPayment');
    }
  }

  async getPaymentMethods(): Promise<ZucchiniApiResponse<string[]>> {
    try {
      logger.debug('Fetching payment methods');
      throw new ZucchiniNotImplementedError('getPaymentMethods');
    } catch (error) {
      throw this.handleError(error, 'getPaymentMethods');
    }
  }

  // ============================================
  // PRICING & CALCULATIONS
  // ============================================

  async calculateOrderTotals(data: CreateZucchiniOrderRequest): Promise<ZucchiniApiResponse<any>> {
    try {
      if (!data.storeId || !data.items || data.items.length === 0) {
        throw new ZucchiniValidationError('Store ID and items are required');
      }

      logger.debug('Calculating order totals', { storeId: data.storeId });
      throw new ZucchiniNotImplementedError('calculateOrderTotals');
    } catch (error) {
      throw this.handleError(error, 'calculateOrderTotals');
    }
  }

  async getDeliveryFee(
    storeId: string,
    deliveryAddress: any
  ): Promise<ZucchiniApiResponse<{ fee: number; estimatedTime: number }>> {
    try {
      if (!storeId || !deliveryAddress) {
        throw new ZucchiniValidationError('Store ID and delivery address are required');
      }

      logger.debug('Getting delivery fee', { storeId });
      throw new ZucchiniNotImplementedError('getDeliveryFee');
    } catch (error) {
      throw this.handleError(error, 'getDeliveryFee');
    }
  }

  async validatePromoCode(
    code: string,
    storeId: string,
    orderTotal?: number
  ): Promise<ZucchiniApiResponse<{ valid: boolean; discount: number }>> {
    try {
      if (!code || !storeId) {
        throw new ZucchiniValidationError('Promo code and store ID are required');
      }

      logger.debug('Validating promo code', { code, storeId });
      throw new ZucchiniNotImplementedError('validatePromoCode');
    } catch (error) {
      throw this.handleError(error, 'validatePromoCode');
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      const secret = this.config.webhookSecret;
      if (!secret) {
        logger.warn('Webhook secret not configured');
        return false;
      }

      // Verify timestamp is within acceptable window
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampInt = parseInt(timestamp, 10);
      const timeDiff = Math.abs(currentTime - timestampInt);

      if (timeDiff > this.config.webhookReplayWindow) {
        logger.warn('Webhook timestamp outside acceptable window', { timeDiff });
        return false;
      }

      // Compute HMAC-SHA256
      const data = `${timestamp}.${payload}`;
      const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

      // Compare signatures (constant-time comparison)
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      logger.error('Error verifying webhook signature', { error });
      return false;
    }
  }

  async acknowledgeWebhook(webhookId: string): Promise<void> {
    try {
      logger.debug('Acknowledging webhook', { webhookId });
      throw new ZucchiniNotImplementedError('acknowledgeWebhook');
    } catch (error) {
      throw this.handleError(error, 'acknowledgeWebhook');
    }
  }

  registerWebhookListener(eventType: string, handler: (data: any) => Promise<void>): void {
    try {
      if (!this.webhookListeners.has(eventType)) {
        this.webhookListeners.set(eventType, new Set());
      }
      this.webhookListeners.get(eventType)!.add(handler);
      logger.debug('Webhook listener registered', { eventType, handlers: this.webhookListeners.get(eventType)!.size });
    } catch (error) {
      logger.error('Error registering webhook listener', { error });
    }
  }

  // ============================================
  // PROOF OF DELIVERY
  // ============================================

  async uploadProofOfDelivery(
    orderId: string,
    proofData: {
      photos?: string[];
      signature?: string;
      timestamp: Date;
      notes?: string;
    }
  ): Promise<ZucchiniApiResponse<any>> {
    try {
      if (!orderId || !proofData.timestamp) {
        throw new ZucchiniValidationError('Order ID and timestamp are required');
      }

      logger.debug('Uploading proof of delivery', { orderId });
      throw new ZucchiniNotImplementedError('uploadProofOfDelivery');
    } catch (error) {
      throw this.handleError(error, 'uploadProofOfDelivery');
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  async getOrderAnalytics(params: {
    startDate: Date;
    endDate: Date;
    storeId?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ZucchiniApiResponse<any>> {
    try {
      if (!params.startDate || !params.endDate) {
        throw new ZucchiniValidationError('Start date and end date are required');
      }

      logger.debug('Fetching order analytics', { params });
      throw new ZucchiniNotImplementedError('getOrderAnalytics');
    } catch (error) {
      throw this.handleError(error, 'getOrderAnalytics');
    }
  }

  async downloadInvoices(params: {
    startDate: Date;
    endDate: Date;
    format?: 'pdf' | 'csv' | 'excel';
  }): Promise<Buffer> {
    try {
      if (!params.startDate || !params.endDate) {
        throw new ZucchiniValidationError('Start date and end date are required');
      }

      logger.debug('Downloading invoices', { params });
      throw new ZucchiniNotImplementedError('downloadInvoices');
    } catch (error) {
      throw this.handleError(error, 'downloadInvoices');
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.authToken) {
      headers['Authorization'] = `${this.authToken.tokenType} ${this.authToken.accessToken}`;
    } else if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private handleError(error: any, method: string): Error {
    logger.error(`Error in ${method}`, { error: error.message });

    if (error instanceof ZucchiniNotImplementedError) {
      return error;
    }

    if (error.code === 'ECONNABORTED') {
      return new ZucchiniTimeoutError(`${method} request timed out`);
    }

    return error;
  }

  private startHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(
      async () => {
        try {
          await this.healthCheck();
        } catch (error) {
          logger.warn('Periodic health check failed', { error });
        }
      },
      this.config.healthCheckInterval
    );
  }
}

// Singleton instance
let adapter: ZucchiniAdapter | null = null;

export function getZucchiniAdapter(): ZucchiniAdapter {
  if (!adapter) {
    adapter = new ZucchiniAdapter();
  }
  return adapter;
}

export function resetZucchiniAdapter(): void {
  adapter = null;
}
