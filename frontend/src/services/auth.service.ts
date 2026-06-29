import client from "../api/client";
import { endpoints } from "../api/endpoints";

type LoginResponse = {
  token: string;
  user?: any;
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const { data } = await client.post<LoginResponse>(endpoints.auth.login, {
      email,
      password,
    });

    if (data?.token) {
      localStorage.setItem("token", data.token);
    }

    return data;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const getMe = async () => {
  try {
    const { data } = await client.get(endpoints.auth.me);
    return data;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw error;
  }
};