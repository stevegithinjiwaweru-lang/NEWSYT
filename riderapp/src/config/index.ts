import { Platform } from "react-native";

const HOST =
  Platform.OS === "android"
    ? "192.168.1.100"
    : "localhost";

// Replace 192.168.1.100 with your PC's actual local IP

export const API_BASE_URL = "http://10.40.27.53:4000";
export const SOCKET_URL = "http://10.40.27.53:4000";