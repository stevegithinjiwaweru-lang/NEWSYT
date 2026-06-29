import { useEffect, useRef, useState } from "react";
import { io, Socket, ManagerOptions, SocketOptions } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SOCKET_URL } from "../config";

type UseSocketOptions = {
  riderId?: string;
};

export function useSocket({ riderId }: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let active = true;

    const connect = async () => {
      const options: Partial<ManagerOptions & SocketOptions> = {
        transports: ["websocket"],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      };

      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        options.auth = { token };
      }

      const storedRiderId =
        riderId || (await AsyncStorage.getItem("riderId"));

      const instance = io(SOCKET_URL, options);

      instance.on("connect", () => {
        if (storedRiderId) {
          instance.emit("join", {
            role: "RIDER",
            riderId: storedRiderId,
          });
        }
      });

      if (active) {
        socketRef.current = instance;
        setSocket(instance);
      } else {
        instance.disconnect();
      }
    };

    connect();

    return () => {
      active = false;
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [riderId]);

  return socket;
}
