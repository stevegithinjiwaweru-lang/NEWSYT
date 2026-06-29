import client from "../api/client";
import { endpoints } from "../api/endpoints";

export type Order = {
  id?: string;
  customerName?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
};

export const createOrder = async (data: Order): Promise<Order> => {
  try {
    const { data: response } = await client.post<Order>(
      endpoints.orders.create,
      data
    );

    return response;
  } catch (error) {
    console.error("Failed to create order:", error);
    throw error;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data } = await client.get<Order[]>(endpoints.orders.getAll);
    return data;
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    throw error;
  }
};