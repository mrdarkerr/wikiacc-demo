import { z } from "zod";
import { badRequest, serviceUnavailable } from "../../shared/errors.js";
import { getSettings } from "./settings.js";
export const superipCheckoutInput = z
  .object({
    username: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{2,63}$/),
    amount: z.number().int().min(1000).max(200000000),
  })
  .strict();
export const SUPERIP_SELECT = {
  id: true,
  username: true,
  amount: true,
  status: true,
  attempts: true,
  lastErrorCode: true,
  receiptId: true,
  deliveredAt: true,
};
export async function superipCheckout(tx, product, input) {
  if (product.type !== "SUPERIP_WALLET") return null;
  if ((input.quantity ?? 1) !== 1)
    throw badRequest(
      "SUPERIP_QUANTITY_INVALID",
      "Wallet top-up quantity must be one",
    );
  const parsed = superipCheckoutInput.safeParse(input.superip);
  if (!parsed.success)
    throw badRequest(
      "SUPERIP_INPUT_INVALID",
      "Enter a valid username and integer toman amount between 1,000 and 200,000,000",
    );
  const settings = await getSettings(tx);
  if (!settings?.enabled || !settings.secretEncrypted)
    throw serviceUnavailable(
      "SUPERIP_NOT_CONFIGURED",
      "Wallet top-up unavailable",
    );
  return {
    ...parsed.data,
    username: parsed.data.username.toLowerCase(),
    endpoint: settings.endpoint,
  };
}
export async function createSuperipSnapshot(tx, item, snapshot) {
  if (!snapshot) return;
  await tx.superipFulfillment.create({
    data: {
      ...snapshot,
      orderItemId: item.id,
      reference: `gimiacc:${item.id}`,
    },
  });
}
export const superipPricedProduct = (product, snapshot) =>
  snapshot
    ? {
        ...product,
        priceCurrency: "TOMAN",
        price: snapshot.amount,
        basePrice: String(snapshot.amount),
        profitType: "TOMAN",
        profitValue: "0",
      }
    : product;
