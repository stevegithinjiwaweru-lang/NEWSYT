import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";

// =====================
// TYPES
// =====================
export type AuthStackParamList = {
  Login: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// =====================
// PROPS
// =====================
type Props = {
  setIsLoggedIn: (value: boolean) => void;
};

// =====================
// AUTH STACK
// =====================
export default function AuthStack({ setIsLoggedIn }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen {...props} setIsLoggedIn={setIsLoggedIn} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}