import { Platform } from "react-native";

/**
 * Set LOCAL_IP to your machine's LAN address when testing on a physical device.
 * Android emulator: use 10.0.2.2
 * iOS simulator: use localhost
 */
const LOCAL_IP =
  Platform.OS === "android" ? "10.0.2.2" : "localhost";

const PORT = 4000;

export const API_BASE_URL = `http://${LOCAL_IP}:${PORT}`;
export const SOCKET_URL = `http://${LOCAL_IP}:${PORT}`;

export const LOCATION_UPDATE_INTERVAL_MS = 10000;
export const API_TIMEOUT_MS = 30000;
