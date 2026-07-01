import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const client = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});

// Add token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default client;
