export type RootStackParamList = {
  Login: undefined;
  Deliveries: undefined;
  OrderDetails: { orderId: string };
  DeliveryProgress: { orderId: string };
};
