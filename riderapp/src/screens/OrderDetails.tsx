import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'

import client from '../api/client'
import { RootStackParamList } from '../navigation/types'
import { API_BASE_URL } from '../config'

type Props = NativeStackScreenProps<
  RootStackParamList,
  'OrderDetails'
>

interface Order {
  id: string
  customerName: string
  phone: string
  address: string
  amount: number
  status: string
  podUrl?: string
}

export default function OrderDetails({
  route,
  navigation,
}: Props) {
  const { orderId } = route.params

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [])

  const fetchOrder = async () => {
    try {
      const { data } = await client.get(`/orders/${orderId}`)
      setOrder(data.order || data)
    } catch (err: any) {
      console.error(err)

      Alert.alert(
        'Error',
        err?.response?.data?.error ??
          err?.message ??
          'Failed to load order.'
      )
    }
  }

  const startDelivery = async () => {
    try {
      setLoading(true)

      await client.patch(`/orders/${orderId}/status`, {
        status: 'PICKED_UP',
      })

      navigation.navigate('DeliveryProgress', {
        orderId,
      })
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.error ??
          err?.message ??
          'Unable to start delivery.'
      )
    } finally {
      setLoading(false)
    }
  }

  const uploadPOD = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync()

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required.'
        )
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      })

      if (result.canceled) return

      const asset = result.assets[0]

      const formData = new FormData()

      formData.append('file', {
        uri: asset.uri,
        name: 'pod.jpg',
        type: 'image/jpeg',
      } as any)

      setLoading(true)

      await client.post(
        `/orders/${orderId}/pod`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      Alert.alert(
        'Success',
        'Proof of delivery uploaded.'
      )

      fetchOrder()
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err?.response?.data?.error ??
          err?.message ??
          'Unable to upload image.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Loading order...
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>
        {order.customerName}
      </Text>

      <Text style={styles.label}>
        Phone
      </Text>
      <Text style={styles.value}>
        {order.phone}
      </Text>

      <Text style={styles.label}>
        Address
      </Text>
      <Text style={styles.value}>
        {order.address}
      </Text>

      <Text style={styles.label}>
        Amount
      </Text>
      <Text style={styles.amount}>
        KSh {order.amount}
      </Text>

      <Text style={styles.label}>
        Status
      </Text>
      <Text style={styles.status}>
        {order.status}
      </Text>

      {order.podUrl ? (
        <>
          <Text style={styles.label}>
            Proof of Delivery
          </Text>

          <Image
            source={{
              uri: order.podUrl.startsWith('http')
                ? order.podUrl
                : `${API_BASE_URL}${order.podUrl}`,
            }}
            style={styles.image}
          />
        </>
      ) : null}

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabled,
        ]}
        onPress={startDelivery}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Start Delivery
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.secondaryButton,
          loading && styles.disabled,
        ]}
        onPress={uploadPOD}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>
          Upload Proof of Delivery
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },

  label: {
    marginTop: 12,
    fontWeight: '700',
    color: '#666',
  },

  value: {
    fontSize: 16,
    marginTop: 4,
  },

  amount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 5,
  },

  status: {
    marginTop: 4,
    fontWeight: '600',
    color: '#2563eb',
  },

  image: {
    marginTop: 10,
    width: '100%',
    height: 220,
    borderRadius: 10,
    resizeMode: 'cover',
  },

  button: {
    marginTop: 30,
    backgroundColor: '#FF6FA3',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },

  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  secondaryButtonText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 16,
  },

  disabled: {
    opacity: 0.7,
  },
})