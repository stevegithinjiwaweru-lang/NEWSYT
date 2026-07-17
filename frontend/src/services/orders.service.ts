import client from "../api/client";
import { endpoints } from "../api/endpoints";

export interface Order {
  id?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  merchantId?: string;
  riderId?: string;
  amount?: number;
  paymentType?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface OrdersResponse {
  ok: boolean;
  items: Order[];
  page: number;
  limit: number;
}

interface CreateOrderResponse {
  ok: boolean;
  order: Order;
}

export const createOrder = async (payload: Order): Promise<Order> => {
  try {
    const { data } = await client.post<CreateOrderResponse>(
      endpoints.orders.create,
      payload
    );

    if (!data.ok) {
      throw new Error("Failed to create order");
    }

    return data.order;
  } catch (error) {
    console.error("Failed to create order:", error);
    throw error;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data } = await client.get<OrdersResponse>(
      endpoints.orders.getAll
    );

    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    throw error;
  }
};