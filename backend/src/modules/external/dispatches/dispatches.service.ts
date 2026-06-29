import { Order, PaymentStatus, PaymentType, Prisma, Rider } from "@prisma/client";
import { prisma } from "../../../prisma";
import { ConflictError, NotFoundError } from "../../../shared/errors/AppError";
import { CreateDispatchInput } from "./dispatches.dto";

export type DispatchWithRider = Order & { rider: Rider | null };

export async function createDispatch(
  merchantId: string,
  input: CreateDispatchInput
): Promise<DispatchWithRider> {
  try {
    return await prisma.order.create({
      data: {
        merchantId,
        externalId: input.external_id,
        customerName: input.customer.name,
        phone: input.customer.phone,
        address: input.drop_off.address,
        lat: input.drop_off.lat ?? null,
        lng: input.drop_off.lng ?? null,
        pickupAddress: input.pickup?.address ?? null,
        pickupLat: input.pickup?.lat ?? null,
        pickupLng: input.pickup?.lng ?? null,
        packageNotes: input.package_notes ?? null,
        amount: input.amount,
        paymentType: input.payment_type as PaymentType,
        paymentStatus:
          (input.payment_type as PaymentType) === PaymentType.COD
            ? PaymentStatus.PENDING
            : PaymentStatus.NOT_REQUIRED,
      },
      include: { rider: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictError(
        `external_id "${input.external_id}" already used for this merchant`,
        "DUPLICATE_EXTERNAL_ID"
      );
    }
    throw err;
  }
}

export async function getDispatchById(
  merchantId: string,
  id: string
): Promise<DispatchWithRider> {
  const order = await prisma.order.findFirst({
    where: { id, merchantId },
    include: { rider: true },
  });
  if (!order) throw new NotFoundError("Dispatch");
  return order;
}

export async function listDispatches(
  merchantId: string,
  filters: { externalId?: string; limit: number }
): Promise<DispatchWithRider[]> {
  return prisma.order.findMany({
    where: {
      merchantId,
      ...(filters.externalId ? { externalId: filters.externalId } : {}),
    },
    include: { rider: true },
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });
}
