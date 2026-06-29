import client from "../api/client";
import { endpoints } from "../api/endpoints";

export type LocationPayload = {
  lat: number;
  lng: number;
};

export type LocationResponse = {
  success?: boolean;
  message?: string;
  [key: string]: any;
};

export const sendLocation = async (
  data: LocationPayload
): Promise<LocationResponse> => {
  try {
    const { data: response } = await client.post<LocationResponse>(
      endpoints.riders.location,
      data
    );

    return response;
  } catch (error) {
    console.error("Failed to send location:", error);
    throw error;
  }
};