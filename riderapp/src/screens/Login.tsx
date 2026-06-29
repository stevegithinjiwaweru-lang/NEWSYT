import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import client from "../api/client";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login"> & {
  onLoginSuccess?: () => void;
};

export default function Login({ navigation, onLoginSuccess }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    Keyboard.dismiss();

    if (!phone.trim()) {
      Alert.alert("Validation", "Please enter your phone number.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Validation", "Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await client.post("/auth/login", {
        phone: phone.trim(),
        password,
      });

      if (data.user?.role !== "RIDER") {
        Alert.alert(
          "Access Denied",
          "This app is for delivery riders only."
        );
        return;
      }

      await AsyncStorage.multiSet([
        ["accessToken", data.accessToken],
        ["refreshToken", data.refreshToken],
        ["user", JSON.stringify(data.user)],
        ["riderId", data.user.riderId || ""],
      ]);

      if (onLoginSuccess) {
        onLoginSuccess();
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "Deliveries" }],
      });
    } catch (err: any) {
      Alert.alert(
        "Login Failed",
        err?.response?.data?.error ||
          err?.message ||
          "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Easybox Rider</Text>
      <Text style={styles.subtitle}>Last-mile delivery</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor="#888"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onLogin}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
    color: "#FF6FA3",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#888",
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  button: {
    backgroundColor: "#FF6FA3",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
