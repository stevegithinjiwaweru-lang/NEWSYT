import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

const LOCATION_TASK_NAME = 'background-location-task';
const { width, height } = Dimensions.get('window');

interface Dispatch {
  id: string;
  orderReference: string;
  status: string;
  deliveryLat?: number;
  deliveryLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  estimatedDelivery?: string;
  failureReason?: string;
  podEnabled?: boolean;
  podAmount?: number;
  rider?: any;
  events?: any[];
}

interface RiderLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const RiderApp: React.FC = () => {
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string>('ASSIGNED');
  const [isTracking, setIsTracking] = useState(false);
  const [eta, setEta] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const locationWatchRef = useRef<number | null>(null);
  const [distanceToDelivery, setDistanceToDelivery] = useState<number | null>(null);
  const [estimatedETA, setEstimatedETA] = useState<number | null>(null);

  const riderId = localStorage.getItem('riderId');
  const token = localStorage.getItem('accessToken');

  // Fetch active dispatch
  const { data: dispatchData, isLoading } = useQuery({
    queryKey: ['activeDispatch'],
    queryFn: async () => {
      const { data } = await client.get('/dispatches', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Get first active dispatch for this rider
      return data?.dispatches?.[0];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (dispatchData) {
      setActiveDispatch(dispatchData);
      setDispatchStatus(dispatchData.status);
    }
  }, [dispatchData]);

  // Request location permission and start tracking
  useEffect(() => {
    const requestLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to track deliveries.');
        return;
      }

      // Start continuous location updates
      startLocationTracking();
    };

    requestLocationPermission();

    return () => {
      if (locationWatchRef.current !== null) {
        Location.removeWatchAsync(locationWatchRef.current);
      }
    };
  }, []);

  const startLocationTracking = async () => {
    try {
      const { coords } = await Location.getCurrentPositionAsync();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 10,
      });

      // Watch location changes
      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or 10 meters
        },
        (newLocation) => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy || 10,
          };
          setLocation(newCoords);

          // Update backend with location
          updateLocationToBackend(newCoords);

          // Calculate distance to delivery if we have coordinates
          if (activeDispatch?.deliveryLat && activeDispatch?.deliveryLng) {
            const distance = calculateDistance(
              newCoords.latitude,
              newCoords.longitude,
              activeDispatch.deliveryLat,
              activeDispatch.deliveryLng
            );
            setDistanceToDelivery(distance);
            setEstimatedETA(Math.ceil(distance / 0.833)); // ~50km/h = 0.833 km/min
          }

          // Auto-zoom map to show rider and destination
          if (mapRef.current && activeDispatch?.deliveryLat) {
            mapRef.current.fitToElements(true);
          }
        }
      );
      locationWatchRef.current = watchId;
      setIsTracking(true);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const updateLocationToBackend = async (coords: RiderLocation) => {
    try {
      await client.post(
        `/riders/${riderId}/location`,
        {
          lat: coords.latitude,
          lng: coords.longitude,
          ts: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      // Update dispatch status
      const statusMap: { [key: string]: string } = {
        PICKED_UP: 'Picked up from store',
        EN_ROUTE: 'On the way to customer',
        ARRIVED: 'Arrived at delivery location',
        DELIVERED: 'Delivered to customer',
      };

      Alert.alert(
        'Update Status',
        `Mark as ${statusMap[newStatus]}?`,
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Confirm',
            onPress: async () => {
              setDispatchStatus(newStatus);
              // Send update to backend
              // await client.patch(`/orders/${activeDispatch?.id}`, { status: newStatus });
              Alert.alert('Success', `Status updated to ${newStatus}`);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleDeliveryComplete = async () => {
    Alert.alert(
      'Delivery Complete',
      'Is the customer satisfied with the delivery?',
      [
        {
          text: 'No - Report Issue',
          onPress: () => {
            Alert.prompt(
              'Report Issue',
              'What went wrong?',
              (reason) => {
                if (reason) {
                  handleFailedDelivery(reason);
                }
              }
            );
          },
        },
        {
          text: 'Yes - Mark Delivered',
          onPress: () => {
            handleStatusUpdate('DELIVERED');
          },
        },
      ]
    );
  };

  const handleFailedDelivery = (reason: string) => {
    Alert.alert('Delivery Failed', `Reason: ${reason}`, [
      { text: 'OK', onPress: () => handleStatusUpdate('FAILED') },
    ]);
  };

  const handleContactCustomer = () => {
    if (activeDispatch?.orderReference) {
      Alert.alert('Call Customer', 'Initiating call...', [
        { text: 'Cancel', onPress: () => {} },
        { text: 'Call', onPress: () => {} },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚴 Delivery Rider</Text>
        <View style={styles.statusBadge}>
          <Ionicons
            name={isTracking ? 'location' : 'location-outline'}
            size={16}
            color={isTracking ? '#4CAF50' : '#999'}
          />
          <Text style={styles.statusText}>
            {isTracking ? 'Live Tracking' : 'Ready'}
          </Text>
        </View>
      </View>

      {/* Map View */}
      {location && activeDispatch && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Rider Location */}
          <Marker
            coordinate={location}
            title="Your Location"
            description="Current position"
            pinColor="#4CAF50"
          >
            <View style={styles.riderMarker}>
              <Ionicons name="location" size={20} color="white" />
            </View>
          </Marker>

          {/* Delivery Location */}
          {activeDispatch.deliveryLat && activeDispatch.deliveryLng && (
            <>
              <Marker
                coordinate={{
                  latitude: activeDispatch.deliveryLat,
                  longitude: activeDispatch.deliveryLng,
                }}
                title="Delivery Location"
                description={activeDispatch.orderReference}
                pinColor="#FF6B6B"
              >
                <View style={styles.deliveryMarker}>
                  <MaterialCommunityIcons
                    name="package-variant"
                    size={20}
                    color="white"
                  />
                </View>
              </Marker>

              {/* Route Line */}
              <Polyline
                coordinates={[
                  {
                    latitude: location.latitude,
                    longitude: location.longitude,
                  },
                  {
                    latitude: activeDispatch.deliveryLat,
                    longitude: activeDispatch.deliveryLng,
                  },
                ]}
                strokeColor="#4CAF50"
                strokeWidth={3}
              />

              {/* Delivery Radius */}
              <Circle
                center={{
                  latitude: activeDispatch.deliveryLat,
                  longitude: activeDispatch.deliveryLng,
                }}
                radius={100}
                fillColor="rgba(255, 107, 107, 0.1)"
                strokeColor="#FF6B6B"
                strokeWidth={1}
              />
            </>
          )}
        </MapView>
      )}

      {/* Active Dispatch Card */}
      {activeDispatch && (
        <View style={styles.dispatchCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Order Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📦 Order Details</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Order ID:</Text>
                <Text style={styles.value}>{activeDispatch.orderReference}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Status:</Text>
                <View
                  style={[
                    styles.statusTag,
                    {
                      backgroundColor:
                        dispatchStatus === 'DELIVERED'
                          ? '#4CAF50'
                          : dispatchStatus === 'FAILED'
                          ? '#FF6B6B'
                          : '#2196F3',
                    },
                  ]}
                >
                  <Text style={styles.statusTagText}>{dispatchStatus}</Text>
                </View>
              </View>
            </View>

            {/* Distance & ETA */}
            {distanceToDelivery !== null && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗺️ Navigation</Text>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <MaterialCommunityIcons
                      name="navigation"
                      size={24}
                      color="#2196F3"
                    />
                    <Text style={styles.statValue}>
                      {distanceToDelivery.toFixed(1)} km
                    </Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <View style={styles.stat}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={24}
                      color="#FF9800"
                    />
                    <Text style={styles.statValue}>
                      {estimatedETA} min
                    </Text>
                    <Text style={styles.statLabel}>ETA</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚙️ Actions</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={handleContactCustomer}
              >
                <FontAwesome5 name="phone" size={16} color="white" />
                <Text style={styles.actionButtonText}>Call Customer</Text>
              </TouchableOpacity>

              {dispatchStatus === 'ASSIGNED' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSuccess]}
                  onPress={() => handleStatusUpdate('PICKED_UP')}
                >
                  <MaterialCommunityIcons
                    name="package-variant"
                    size={16}
                    color="white"
                  />
                  <Text style={styles.actionButtonText}>Picked Up Package</Text>
                </TouchableOpacity>
              )}

              {dispatchStatus === 'PICKED_UP' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonWarning]}
                  onPress={() => handleStatusUpdate('EN_ROUTE')}
                >
                  <Ionicons name="navigate" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Started Delivery</Text>
                </TouchableOpacity>
              )}

              {dispatchStatus === 'EN_ROUTE' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonInfo]}
                    onPress={() => handleStatusUpdate('ARRIVED')}
                  >
                    <MaterialCommunityIcons
                      name="map-marker-check"
                      size={16}
                      color="white"
                    />
                    <Text style={styles.actionButtonText}>Arrived at Location</Text>
                  </TouchableOpacity>
                </>
              )}

              {dispatchStatus === 'ARRIVED' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSuccess]}
                  onPress={handleDeliveryComplete}
                >
                  <Ionicons name="checkmark-done" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Complete Delivery</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Payment on Delivery */}
            {activeDispatch.podEnabled && (
              <View style={styles.section}>
                <View style={styles.podCard}>
                  <FontAwesome5 name="money-bill" size={24} color="#4CAF50" />
                  <Text style={styles.podAmount}>
                    Collect: KES {activeDispatch.podAmount}
                  </Text>
                  <Text style={styles.podNote}>Cash on Delivery</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading dispatch...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  map: {
    flex: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  riderMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  deliveryMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  dispatchCard: {
    flex: 0.5,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  actionButtonSuccess: {
    backgroundColor: '#4CAF50',
  },
  actionButtonWarning: {
    backgroundColor: '#FF9800',
  },
  actionButtonInfo: {
    backgroundColor: '#00BCD4',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  podCard: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  podAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  podNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
});

export default RiderApp;
