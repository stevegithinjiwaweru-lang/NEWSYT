import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

const { width } = Dimensions.get('window');

interface RiderStats {
  totalDeliveries: number;
  completedToday: number;
  earnings: number;
  rating: number;
}

const RiderProfileScreen: React.FC = () => {
  const [riderData, setRiderData] = useState<any>(null);
  const [stats, setStats] = useState<RiderStats>({
    totalDeliveries: 0,
    completedToday: 0,
    earnings: 0,
    rating: 0,
  });
  const [isOnline, setIsOnline] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const token = localStorage.getItem('accessToken');
  const riderId = localStorage.getItem('riderId');

  // Fetch rider profile
  const { data: profileData } = useQuery({
    queryKey: ['riderProfile'],
    queryFn: async () => {
      const { data } = await client.get(`/riders/${riderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data?.rider;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (profileData) {
      setRiderData(profileData);
      // Simulate stats
      setStats({
        totalDeliveries: Math.floor(Math.random() * 150) + 50,
        completedToday: Math.floor(Math.random() * 20) + 5,
        earnings: Math.floor(Math.random() * 5000) + 1000,
        rating: (Math.random() * 1 + 4.5).toFixed(1) as any,
      });
    }
  }, [profileData]);

  const handleToggleOnline = async () => {
    setIsOnline(!isOnline);
    // Update status on backend
    const newStatus = !isOnline ? 'AVAILABLE' : 'OFFLINE';
    try {
      await client.patch(
        `/riders/${riderId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons
              name="account-circle"
              size={80}
              color="#2196F3"
            />
            <View
              style={[
                styles.onlineBadge,
                { backgroundColor: isOnline ? '#4CAF50' : '#ccc' },
              ]}
            >
              <Ionicons name="checkmark" size={12} color="white" />
            </View>
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{riderData?.name || 'Rider'}</Text>
            <Text style={styles.phone}>{riderData?.phone}</Text>
            <View style={styles.vehicleInfo}>
              <MaterialCommunityIcons
                name="motorcycle"
                size={14}
                color="#999"
              />
              <Text style={styles.vehicle}>
                {riderData?.vehicleType || 'Unknown'} • {riderData?.vehiclePlate || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Online Toggle */}
        <View style={styles.onlineToggleContainer}>
          <Text style={styles.onlineToggleLabel}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={isOnline ? '#fff' : '#fff'}
          />
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <FontAwesome5 name="box" size={24} color="#2196F3" />
          <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
          <Text style={styles.statLabel}>Total Deliveries</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-done-sharp" size={24} color="#4CAF50" />
          <Text style={styles.statValue}>{stats.completedToday}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <FontAwesome5 name="money-bill-wave" size={24} color="#FF9800" />
          <Text style={styles.statValue}>KES {stats.earnings}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="star" size={24} color="#FFC107" />
          <Text style={styles.statValue}>{stats.rating}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => Alert.alert('Documents', 'Upload your documents')}
        >
          <MaterialCommunityIcons name="file-document" size={24} color="#2196F3" />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>My Documents</Text>
            <Text style={styles.actionDesc}>License, ID, Insurance</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => Alert.alert('Bank Details', 'Manage your bank account')}
        >
          <MaterialCommunityIcons name="bank" size={24} color="#4CAF50" />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Bank Details</Text>
            <Text style={styles.actionDesc}>Update payment method</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => Alert.alert('Promo', 'Enter promo code')}
        >
          <MaterialCommunityIcons name="ticket-percent" size={24} color="#FF9800" />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Promo Code</Text>
            <Text style={styles.actionDesc}>Apply referral or bonus</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications" size={20} color="#2196F3" />
            <Text style={styles.settingLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="location" size={20} color="#FF6B6B" />
            <Text style={styles.settingLabel}>Location Sharing</Text>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={setLocationEnabled}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => Alert.alert('Support', 'Contact support team')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle" size={20} color="#4CAF50" />
            <Text style={styles.settingLabel}>Contact Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => Alert.alert('About', 'Rider App v1.0')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.settingLabel}>About App</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() =>
          Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', onPress: () => {} },
            {
              text: 'Logout',
              onPress: () => {
                // Handle logout
                localStorage.removeItem('accessToken');
              },
              style: 'destructive',
            },
          ])
        }
      >
        <Ionicons name="log-out" size={20} color="white" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  phone: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  vehicle: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  onlineToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  onlineToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: 12,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  actionContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 12,
    marginVertical: 16,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});

export default RiderProfileScreen;
