import { io } from "./app";
import { prisma } from "./prisma";
import { publishOrderStatusEvent } from "./modules/external/webhooks/dispatchEvents";
import { publishLocation } from "./modules/external/location/location.cache";

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
        const now = new Date();
        await prisma.rider.update({
          where: {
            id: data.riderId,
          },
          data: {
            lastLat: data.lat,
            lastLng: data.lng,
            lastSeenAt: now,
          },
        });

        await publishLocation({
          riderId: data.riderId,
          lat: data.lat,
          lng: data.lng,
          bearing: data.bearing ?? null,
          speed: data.speed ?? null,
          lastSeenAt: now.toISOString(),
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

        const updated = await prisma.order.update({
          where: {
            id: data.orderId,
          },
          data: {
            riderId: data.riderId,
            status: "ASSIGNED",
          },
          include: { rider: true },
        });

        io.to(RIDER_ROOM(data.riderId)).emit(
          "order:assigned",
          {
            orderId: data.orderId,
            message: "New delivery assigned",
          }
        );

        io.to(DISPATCH_ROOM).emit(
          "order:assigned",
          data
        );

        await publishOrderStatusEvent(updated);

        console.log("📦 Order assigned:", data);
      } catch (error) {
        console.error("Order assignment error:", error);
      }
    }
  );

  // =====================
  // ORDER STATUS UPDATE
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

        const updated = await prisma.order.update({
          where: {
            id: data.orderId,
          },
          data: {
            status: data.status as any,
          },
          include: { rider: true },
        });

        io.to(DISPATCH_ROOM).emit(
          "order:tracking:update",
          data
        );

        await publishOrderStatusEvent(updated);

        console.log("📊 Order status:", data);
      } catch (error) {
        console.error("Order status error:", error);
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