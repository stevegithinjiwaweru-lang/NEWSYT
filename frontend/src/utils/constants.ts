// Order Statuses
export const ORDER_STATUSES = {
  NEW: { label: 'New', color: 'blue', description: 'Order created' },
  ASSIGNED: { label: 'Assigned', color: 'orange', description: 'Assigned to rider' },
  PICKED_UP: { label: 'Picked Up', color: 'cyan', description: 'Order picked up' },
  IN_TRANSIT: { label: 'In Transit', color: 'purple', description: 'Rider on the way' },
  DELIVERED: { label: 'Delivered', color: 'green', description: 'Order delivered' },
  FAILED: { label: 'Failed', color: 'red', description: 'Delivery failed' },
  RETURNED: { label: 'Returned', color: 'magenta', description: 'Order returned' },
};

// Payment Types
export const PAYMENT_TYPES = {
  COD: { label: 'Cash on Delivery', color: 'blue' },
  PREPAID: { label: 'Prepaid', color: 'green' },
};

// Merchant Statuses
export const MERCHANT_STATUSES = {
  CONNECTED: { label: 'Connected', color: 'green' },
  DISCONNECTED: { label: 'Disconnected', color: 'red' },
};

// Rider Statuses
export const RIDER_STATUSES = {
  AVAILABLE: { label: 'Available', color: 'green' },
  BUSY: { label: 'Busy', color: 'orange' },
  OFFLINE: { label: 'Offline', color: 'default' },
  SUSPENDED: { label: 'Suspended', color: 'red' },
  IN_DELIVERY: { label: 'In Delivery', color: 'purple' },
};
