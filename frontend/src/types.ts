export type Role = "admin" | "dispatcher" | "rider";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type MerchantConnector = "csv" | "api" | "app";
export type MerchantStatus = "connected" | "disconnected";

export type Merchant = {
  id: string;
  name: string;
  connector: MerchantConnector;
  status: MerchantStatus;
  lastSync?: string;
};

export type OrderStatus =
  | "new"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed"
  | "returned";

export type PaymentType = "COD" | "Prepaid";

export type Order = {
  id: string;
  merchantId: string;
  merchantName: string;
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
};

export type RiderStatus =
  | "available"
  | "busy"
  | "offline"
  | "suspended"
  | "in_delivery";

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
};