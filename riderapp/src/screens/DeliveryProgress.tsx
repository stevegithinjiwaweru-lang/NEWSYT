import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../api/client";
import { LOCATION_UPDATE_INTERVAL_MS } from "../config";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "DeliveryProgress"
>;

export default function DeliveryProgress({ route, navigation }: Props) {
  const { orderId } = route.params;

  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);

  const mapRef = useRef<MapView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const riderIdRef = useRef<string | null>(null);

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  const startTracking = async () => {
    try {
      const riderId = await AsyncStorage.getItem("riderId");
      riderIdRef.current = riderId;

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required."
        );
        return;
      }

      await client.patch(`/orders/${orderId}/status`, {
        status: "IN_TRANSIT",
      });

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(current.coords);

      intervalRef.current = setInterval(async () => {
        try {
          const cur = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setLocation(cur.coords);

          mapRef.current?.animateCamera({
            center: {
              latitude: cur.coords.latitude,
              longitude: cur.coords.longitude,
            },
            zoom: 17,
          });

          if (riderIdRef.current) {
            await client.post(
              `/riders/${riderIdRef.current}/location`,
              {
                lat: cur.coords.latitude,
                lng: cur.coords.longitude,
                timestamp: new Date().toISOString(),
              }
            );
          }
        } catch (err) {
          console.warn("Location update error:", err);
        }
      }, LOCATION_UPDATE_INTERVAL_MS);
    } catch (err) {
      console.warn(err);
      Alert.alert("Error", "Unable to obtain your location.");
    }
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const markDelivered = async () => {
    try {
      await client.patch(`/orders/${orderId}/status`, {
        status: "DELIVERED",
      });

      Alert.alert("Success", "Order marked as delivered.");
      navigation.popToTop();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error ||
          err?.message ||
          "Failed to update order."
      );
    }
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6FA3" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You"
          description="Current Rider Location"
        />
      </MapView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.button} onPress={markDelivered}>
          <Text style={styles.buttonText}>Mark as Delivered</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#555" },
  bottomContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  button: {
    backgroundColor: "#16a34a",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
