import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DeliveriesScreen from "../screens/DeliveriesScreen";
import OrderDetailsScreen from "../screens/OrderDetailsScreen";

// =====================
// TYPES (optional but recommended)
// =====================
export type AppStackParamList = {
  Deliveries: undefined;
  OrderDetails: { orderId: string };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

// =====================
// APP STACK
// =====================
type Props = {
  setIsLoggedIn?: (value: boolean) => void;
};

export default function AppStack({ setIsLoggedIn }: Props) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleAlign: "center",
      }}
    >
      {/* ===================== */}
      {/* DELIVERIES SCREEN */}
      {/* ===================== */}
      <Stack.Screen
        name="Deliveries"
        component={DeliveriesScreen}
        options={{
          title: "My Deliveries",
        }}
      />

      {/* ===================== */}
      {/* ORDER DETAILS SCREEN */}
      {/* ===================== */}
      <Stack.Screen
        name="OrderDetails"
        component={OrderDetailsScreen}
        options={{
          title: "Order Details",
        }}
      />
    </Stack.Navigator>
  );
}