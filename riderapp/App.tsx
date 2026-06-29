import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Login from "./src/screens/Login";
import Deliveries from "./src/screens/Deliveries";
import OrderDetails from "./src/screens/OrderDetails";
import DeliveryProgress from "./src/screens/DeliveryProgress";
import { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("accessToken").then((token) => {
      setIsLoggedIn(!!token);
    });
  }, []);

  if (isLoggedIn === null) {
    return null;
  }

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      "accessToken",
      "refreshToken",
      "user",
      "riderId",
    ]);
    setIsLoggedIn(false);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isLoggedIn ? "Deliveries" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login">
          {(props) => (
            <Login
              {...props}
              onLoginSuccess={() => setIsLoggedIn(true)}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="Deliveries"
          options={{ headerShown: true, title: "My Deliveries" }}
        >
          {(props) => (
            <Deliveries {...props} onLogout={handleLogout} />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="OrderDetails"
          component={OrderDetails}
          options={{ headerShown: true, title: "Order Details" }}
        />

        <Stack.Screen
          name="DeliveryProgress"
          component={DeliveryProgress}
          options={{ headerShown: true, title: "In Transit" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
