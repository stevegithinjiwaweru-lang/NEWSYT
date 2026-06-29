import { io } from "../app";

export async function assignOrderToRider(orderId: string, riderId: string) {
  io.to(`rider_${riderId}`).emit("order:assigned", {
    orderId,
    message: "New delivery assigned",
  });

  io.to("dispatchers").emit("order:assigned:confirm", {
    orderId,
    riderId,
  });
}