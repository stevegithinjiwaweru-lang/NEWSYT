/**
 * Core type definitions for Zucchini integration
 * These are placeholder types that will be replaced with actual Zucchini API types
 * once API documentation becomes available
 */

// ============================================
// ERROR TYPES
// ============================================

export interface ZucchiniError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode?: number;
  retryable?: boolean;
  timestamp?: Date;
}

export class ZucchiniIntegrationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ZucchiniIntegrationError';
  }
}

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`Method not implemented: ${method}. Zucchini API credentials not yet available.`);
    this.name = 'NotImplementedError';
  }
}

// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface ZucchiniAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

export interface ZucchiniCredentials {
  apiKey: string;
  apiSecret: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface ZucchiniApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ZucchiniError;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ZucchiniPaginatedResponse<T = any> extends ZucchiniApiResponse<T[]> {
  pagination?: PaginationMeta;
}

// ============================================
// CUSTOMER TYPES
// ============================================

export interface ZucchiniCustomer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  profilePicture?: string;
  addresses: ZucchiniAddress[];
  defaultAddressId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ZucchiniAddress {
  id: string;
  label?: string; // 'Home', 'Work', etc.
  street: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  latitude: number;
  longitude: number;
  instructions?: string;
  isDefault?: boolean;
}

export interface CreateZucchiniCustomerRequest {
  phone: string;
  name: string;
  email?: string;
  profilePicture?: string;
}

// ============================================
// MERCHANT/STORE TYPES
// ============================================

export interface ZucchiniMerchant {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  storeType: string; // 'restaurant', 'supermarket', etc.
  operatingHours: ZucchiniOperatingHours[];
  contactNumber: string;
  contactEmail?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ZucchiniStore {
  id: string;
  merchantId: string;
  name: string;
  address: ZucchiniAddress;
  phoneNumber: string;
  operatingHours: ZucchiniOperatingHours[];
  deliveryZones: ZucchiniDeliveryZone[];
  metadata?: Record<string, any>;
}

export interface ZucchiniOperatingHours {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  closed?: boolean;
}

export interface ZucchiniDeliveryZone {
  id: string;
  name: string;
  polygon: Array<[number, number]>; // lat/lng pairs
  deliveryFeeType: 'fixed' | 'distance_based';
  deliveryFee?: number;
  minDeliveryTime?: number; // minutes
  maxDeliveryTime?: number; // minutes
  disabled?: boolean;
}

// ============================================
// MENU/PRODUCT TYPES
// ============================================

export interface ZucchiniMenu {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  categories: ZucchiniMenuCategory[];
  metadata?: Record<string, any>;
}

export interface ZucchiniMenuCategory {
  id: string;
  menuId: string;
  name: string;
  description?: string;
  displayOrder: number;
  items: ZucchiniMenuItem[];
}

export interface ZucchiniMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  image?: string;
  available: boolean;
  variants?: ZucchiniProductVariant[];
  addOns?: ZucchiniAddOn[];
  metadata?: Record<string, any>;
}

export interface ZucchiniProductVariant {
  id: string;
  name: string; // e.g., 'Size', 'Color'
  options: ZucchiniVariantOption[];
  required?: boolean;
}

export interface ZucchiniVariantOption {
  id: string;
  name: string; // e.g., 'Small', 'Medium', 'Large'
  priceModifier?: number;
}

export interface ZucchiniAddOn {
  id: string;
  name: string;
  price: number;
  optional?: boolean;
  maxQuantity?: number;
}

// ============================================
// ORDER TYPES
// ============================================

export interface ZucchiniOrder {
  id: string;
  referenceNumber?: string;
  storeId: string;
  customerId: string;
  customer: ZucchiniCustomer;
  items: ZucchiniOrderItem[];
  deliveryAddress: ZucchiniAddress;
  deliveryInstructions?: string;
  paymentMethod: 'CASH' | 'CARD' | 'WALLET' | 'MPESA';
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  status: ZucchiniOrderStatus;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount?: number;
  total: number;
  notes?: string;
  scheduledTime?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type ZucchiniOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface ZucchiniOrderItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariants?: Record<string, string>; // variantId -> optionId
  selectedAddOns?: Array<{ id: string; name: string; price: number }>;
  notes?: string;
}

export interface CreateZucchiniOrderRequest {
  storeId: string;
  customerId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    selectedVariants?: Record<string, string>;
    selectedAddOns?: string[]; // addOn IDs
    notes?: string;
  }>;
  deliveryAddressId?: string;
  deliveryAddress?: Omit<ZucchiniAddress, 'id'>;
  deliveryInstructions?: string;
  paymentMethod: string;
  notes?: string;
  scheduledTime?: string;
  promoCode?: string;
}

export interface UpdateZucchiniOrderRequest {
  status?: ZucchiniOrderStatus;
  paymentStatus?: string;
  items?: ZucchiniOrderItem[];
  notes?: string;
  metadata?: Record<string, any>;
}

// ============================================
// PAYMENT TYPES
// ============================================

export interface ZucchiniPayment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transactionId?: string;
  transactionDate: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface ZucchiniPaymentIntent {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  clientSecret?: string;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface ZucchiniWebhookEvent<T = any> {
  id: string;
  eventType: string;
  data: T;
  timestamp: string;
  signature: string; // HMAC-SHA256
}

export type ZucchiniWebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.confirmed'
  | 'order.cancelled'
  | 'order.delivered'
  | 'payment.received'
  | 'payment.failed'
  | 'menu.updated'
  | 'inventory.changed'
  | 'store.opened'
  | 'store.closed';

// ============================================
// SYNC TYPES
// ============================================

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsFailed: number;
  errors: Array<{ itemId: string; error: string }>;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

// ============================================
// QUERY TYPES
// ============================================

export interface ZucchiniQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  startDate?: string;
  endDate?: string;
}

// ============================================
// INTEGRATION STATUS TYPES
// ============================================

export interface IntegrationStatus {
  enabled: boolean;
  connected: boolean;
  lastHealthCheck: Date;
  lastSuccessfulSync: Date | null;
  lastError: string | null;
  errorCount: number;
  warningCount: number;
  webhookReceived: number;
  webhookFailed: number;
  ordersProcessed: number;
  ordersFailed: number;
  averageResponseTime: number; // ms
  uptime: number; // percentage
}

// ============================================
// FEATURE FLAG TYPES
// ============================================

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
}
