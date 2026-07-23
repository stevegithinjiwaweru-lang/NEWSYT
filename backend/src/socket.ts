import { io } from "./app";
import { prisma } from "./prisma";
import { orderService } from "./services/orderService";

interface RiderLocation {
  riderId: string;
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
  status?: string;
}

const RIDER_ROOM = (id: string) => `rider:${id}`;
const DISPATCH_ROOM = "dashboard";

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // =====================
  // JOIN ROOMS
  // =====================
  socket.on(
    "join",
    (data: { role: "RIDER" | "DISPATCHER"; riderId?: string }) => {
      if (!data?.role) return;

      if (data.role === "RIDER" && data.riderId) {
        socket.join(RIDER_ROOM(data.riderId));
        socket.data.riderId = data.riderId;

        console.log(`🚴 Rider joined: ${data.riderId}`);
      }

      if (data.role === "DISPATCHER") {
        socket.join(DISPATCH_ROOM);

        console.log("📦 Dispatcher joined dashboard");
      }
    }
  );

  // =====================
  // LIVE RIDER LOCATION
  // =====================
  socket.on("rider:location", async (data: RiderLocation) => {
    try {
      if (
        !data?.riderId ||
        data.lat === undefined ||
        data.lng === undefined
      ) {
        return;
      }

      const payload = {
        ...data,
        timestamp: new Date().toISOString(),
      };

      // =====================
      // SAVE TO DATABASE
      // =====================
      const rider = await prisma.rider.findUnique({
        where: {
          id: data.riderId,
        },
      });

      if (rider) {
        await prisma.rider.update({
          where: {
            id: data.riderId,
          },
          data: {
            lastLat: data.lat,
            lastLng: data.lng,
            lastSeenAt: new Date(),
          },
        });
      }

      // =====================
      // DASHBOARD BROADCAST
      // =====================
      io.to(DISPATCH_ROOM).emit(
        "rider:location:update",
        payload
      );

      // =====================
      // ACK TO RIDER
      // =====================
      io.to(RIDER_ROOM(data.riderId)).emit(
        "location:ack",
        {
          success: true,
          timestamp: payload.timestamp,
        }
      );

      console.log("📍 Rider location:", payload);
    } catch (error) {
      console.error("Location update error:", error);
    }
  });

  // =====================
  // ORDER ASSIGNMENT
  // Routed through orderService so this shares the same race/capacity
  // guarantees as the HTTP POST /orders/:id/assign path.
  // =====================
  socket.on(
    "order:assign",
    async (data: {
      riderId: string;
      orderId: string;
    }) => {
      try {
        if (!data?.riderId || !data?.orderId) {
          return;
        }

        const order = await orderService.assignToRider(data.orderId, data.riderId);

        io.to(RIDER_ROOM(data.riderId)).emit("order:assigned", { order });
        io.to(DISPATCH_ROOM).emit("order:assigned", { order });

        console.log("📦 Order assigned:", data);
      } catch (error: any) {
        console.error("Order assignment error:", error);
        socket.emit("order:assign:error", { message: error?.message || "Failed to assign order" });
      }
    }
  );

  // =====================
  // ORDER STATUS UPDATE
  // Routed through orderService so a terminal status frees the rider's
  // capacity the same way the HTTP PATCH /orders/:id/status path does.
  // =====================
  socket.on(
    "order:status",
    async (data: {
      orderId: string;
      status: string;
    }) => {
      try {
        if (!data?.orderId || !data?.status) {
          return;
        }

        const order = await orderService.updateStatus(data.orderId, data.status);

        io.to(DISPATCH_ROOM).emit("order:status:update", { order });

        console.log("📊 Order status:", data);
      } catch (error: any) {
        console.error("Order status error:", error);
        socket.emit("order:status:error", { message: error?.message || "Failed to update order status" });
      }
    }
  );

  // =====================
  // DISCONNECT
  // =====================
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});