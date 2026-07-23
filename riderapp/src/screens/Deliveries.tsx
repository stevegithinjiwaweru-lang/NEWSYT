import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import client from "../api/client";
import { RootStackParamList } from "../navigation/types";
import { useSocket } from "../hooks/useSocket";

type Props = NativeStackScreenProps<RootStackParamList, "Deliveries"> & {
  onLogout?: () => void;
};

interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  amount: number;
  status: "NEW" | "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
}

const ACTIVE_STATUSES: Order["status"][] = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
];

export default function Deliveries({ navigation, onLogout }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const socket = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await client.get("/orders/mine");
      const list: Order[] = response.data.items || [];

      setOrders(
        list.filter((order) => ACTIVE_STATUSES.includes(order.status))
      );
    } catch (error) {
      console.error("Failed to fetch deliveries:", error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => fetchOrders();

    socket.on("order:assigned", handleUpdate);
    socket.on("order:status:update", handleUpdate);

    return () => {
      socket.off("order:assigned", handleUpdate);
      socket.off("order:status:update", handleUpdate);
    };
  }, [socket, fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() =>
        navigation.navigate("OrderDetails", { orderId: item.id })
      }
    >
      <View style={styles.left}>
        <Text style={styles.orderId}>#{item.id.slice(-6).toUpperCase()}</Text>
        <Text style={styles.customer}>
          {item.customerName} • {item.phone}
        </Text>
        <Text style={styles.address}>{item.address}</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>
          KSh {item.amount.toLocaleString()}
        </Text>
        <Text style={styles.status}>{item.status.replace("_", " ")}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF6FA3" />
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Deliveries</Text>
        {onLogout && (
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No active deliveries. Pull to refresh.
          </Text>
        }
        contentContainerStyle={
          orders.length === 0 ? styles.emptyContainer : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  logout: {
    color: "#FF6FA3",
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  left: { flex: 1, marginRight: 12 },
  right: { alignItems: "flex-end", justifyContent: "center" },
  orderId: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  customer: { color: "#333333" },
  address: { color: "#777777", marginTop: 8 },
  amount: { fontWeight: "700", color: "#E91E63", fontSize: 16 },
  status: { marginTop: 8, color: "#666666", fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#666" },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  empty: { textAlign: "center", color: "#888", fontSize: 16 },
});
