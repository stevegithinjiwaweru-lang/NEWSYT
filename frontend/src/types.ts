export type Role = "admin" | "dispatcher" | "rider";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type MerchantConnector = "CSV" | "API" | "APP";
export type MerchantStatus = "CONNECTED" | "DISCONNECTED";

export type Merchant = {
  id: string;
  name: string;
  connector: MerchantConnector;
  status: MerchantStatus;
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OrderStatus =
  | "NEW"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED";

export type PaymentType = "COD" | "PREPAID";

export type Order = {
  id: string;
  merchantId: string;
  merchant?: Merchant;
  customerName: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
  amount: number;
  paymentType: PaymentType;
  status: OrderStatus;
  riderId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type RiderStatus =
  | "AVAILABLE"
  | "BUSY"
  | "OFFLINE"
  | "SUSPENDED"
  | "IN_DELIVERY";

export type RiderLocation = {
  lat: number;
  lng: number;
  timestamp: string;
};

export type Rider = {
  id: string;
  name: string;
  phone: string;
  nationalId?: string;
  bikeReg?: string;
  branch?: string;
  status: RiderStatus;
  lastLocation?: RiderLocation;
  userId?: string;
};
