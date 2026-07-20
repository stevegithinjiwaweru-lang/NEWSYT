import {
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
} from '../types';

/**
 * IZucchiniAdapter
 *
 * Interface for Zucchini platform adapter.
 * All methods are production-ready interfaces that will be implemented
 * once official Zucchini API documentation and credentials are available.
 *
 * Implementation strategy:
 * - Each method includes strict request/response models
 * - Validation happens before API calls
 * - Retry logic, logging, and telemetry are built-in
 * - Methods throw meaningful typed exceptions
 * - No blocking on missing credentials
 */

export interface IZucchiniAdapter {
  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Initialize the adapter
   * Validates configuration and establishes connection
   */
  initialize(): Promise<void>;

  /**
   * Check connection status
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get integration status
   */
  getStatus(): Promise<IntegrationStatus>;

  /**
   * Graceful shutdown
   */
  shutdown(): Promise<void>;

  // ============================================
  // AUTHENTICATION
  // ============================================

  /**
   * Authenticate with Zucchini API
   * Returns bearer token for subsequent requests
   */
  authenticate(): Promise<string>;

  /**
   * Refresh authentication token
   */
  refreshToken(): Promise<string>;

  /**
   * Verify credentials are valid
   */
  verifyCredentials(): Promise<boolean>;

  // ============================================
  // STORES & MERCHANTS
  // ============================================

  /**
   * Get list of all stores
   */
  getStores(params?: ZucchiniQueryParams): Promise<ZucchiniPaginatedResponse<ZucchiniStore>>;

  /**
   * Get specific store by ID
   */
  getStore(storeId: string): Promise<ZucchiniApiResponse<ZucchiniStore>>;

  /**
   * Search stores by location, name, etc.
   */
  searchStores(query: string): Promise<ZucchiniPaginatedResponse<ZucchiniStore>>;

  // ============================================
  // MENU & PRODUCTS
  // ============================================

  /**
   * Get menu for a store
   */
  getMenu(storeId: string): Promise<ZucchiniApiResponse<ZucchiniMenu>>;

  /**
   * Search products across stores
   */
  searchProducts(query: string, storeId?: string): Promise<ZucchiniPaginatedResponse<any>>;

  /**
   * Sync menu items to local cache
   */
  syncMenu(storeId: string): Promise<any>;

  /**
   * Check product availability
   */
  checkProductAvailability(storeId: string, productId: string): Promise<boolean>;

  // ============================================
  // CUSTOMERS
  // ============================================

  /**
   * Get customer by ID or phone
   */
  getCustomer(identifier: string): Promise<ZucchiniApiResponse<ZucchiniCustomer>>;

  /**
   * Create new customer
   */
  createCustomer(data: CreateZucchiniCustomerRequest): Promise<ZucchiniApiResponse<ZucchiniCustomer>>;

  /**
   * Update customer information
   */
  updateCustomer(customerId: string, data: Partial<CreateZucchiniCustomerRequest>): Promise<ZucchiniApiResponse<ZucchiniCustomer>>;

  /**
   * Sync customers to local database
   */
  syncCustomers(): Promise<any>;

  // ============================================
  // ORDERS
  // ============================================

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Create new order
   */
  createOrder(data: CreateZucchiniOrderRequest): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Update order
   */
  updateOrder(orderId: string, data: UpdateZucchiniOrderRequest): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Cancel order
   */
  cancelOrder(orderId: string, reason?: string): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Accept order (merchant action)
   */
  acceptOrder(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Reject order (merchant action)
   */
  rejectOrder(orderId: string, reason: string): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Confirm order is ready (merchant action)
   */
  confirmOrderReady(orderId: string): Promise<ZucchiniApiResponse<ZucchiniOrder>>;

  /**
   * Get order status
   */
  getOrderStatus(orderId: string): Promise<ZucchiniApiResponse<{ status: string; updatedAt: string }>>;

  /**
   * Get delivery address for order
   */
  getOrderDeliveryAddress(orderId: string): Promise<ZucchiniApiResponse<any>>;

  /**
   * List orders with filters
   */
  listOrders(params: ZucchiniQueryParams): Promise<ZucchiniPaginatedResponse<ZucchiniOrder>>;

  /**
   * Sync orders from Zucchini to local database
   */
  syncOrders(params?: { from?: Date; to?: Date }): Promise<any>;

  // ============================================
  // PAYMENTS
  // ============================================

  /**
   * Get payment details
   */
  getPayment(orderId: string): Promise<ZucchiniApiResponse<ZucchiniPayment>>;

  /**
   * Confirm payment
   */
  confirmPayment(orderId: string, transactionId: string): Promise<ZucchiniApiResponse<ZucchiniPayment>>;

  /**
   * Process refund
   */
  refundPayment(orderId: string, amount?: number): Promise<ZucchiniApiResponse<any>>;

  /**
   * Get available payment methods
   */
  getPaymentMethods(): Promise<ZucchiniApiResponse<string[]>>;

  // ============================================
  // PRICING & CALCULATIONS
  // ============================================

  /**
   * Calculate order totals (with taxes, fees, discounts)
   */
  calculateOrderTotals(data: CreateZucchiniOrderRequest): Promise<ZucchiniApiResponse<any>>;

  /**
   * Get delivery fee for address
   */
  getDeliveryFee(storeId: string, deliveryAddress: any): Promise<ZucchiniApiResponse<{ fee: number; estimatedTime: number }>>;

  /**
   * Validate promo code
   */
  validatePromoCode(code: string, storeId: string, orderTotal?: number): Promise<ZucchiniApiResponse<{ valid: boolean; discount: number }>>;

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean;

  /**
   * Acknowledge webhook receipt
   */
  acknowledgeWebhook(webhookId: string): Promise<void>;

  /**
   * Register webhook listener
   */
  registerWebhookListener(eventType: string, handler: (data: any) => Promise<void>): void;

  // ============================================
  // PROOF OF DELIVERY
  // ============================================

  /**
   * Upload proof of delivery
   */
  uploadProofOfDelivery(orderId: string, proofData: {
    photos?: string[];
    signature?: string;
    timestamp: Date;
    notes?: string;
  }): Promise<ZucchiniApiResponse<any>>;

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  /**
   * Get order analytics
   */
  getOrderAnalytics(params: {
    startDate: Date;
    endDate: Date;
    storeId?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ZucchiniApiResponse<any>>;

  /**
   * Download invoices
   */
  downloadInvoices(params: {
    startDate: Date;
    endDate: Date;
    format?: 'pdf' | 'csv' | 'excel';
  }): Promise<Buffer>;
}
