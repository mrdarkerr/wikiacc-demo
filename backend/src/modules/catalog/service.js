import { badRequest, notFound } from "../../shared/errors.js";
import {
  findActiveProductBySlug,
  listActiveCategories,
  listActiveProducts,
} from "./repository.js";

export async function getCategories(prisma) {
  return listActiveCategories(prisma);
}

export async function getProducts(prisma, filters) {
  return listActiveProducts(prisma, filters);
}

export async function getProductBySlug(prisma, slug) {
  const product = await findActiveProductBySlug(prisma, slug);
  if (!product) {
    throw notFound("PRODUCT_NOT_FOUND", "Product was not found");
  }
  return product;
}

export function validateProductInput(input) {
  if (input.type === "CUSTOM_FORM" && input.deliveryPoolId) {
    throw badRequest(
      "CUSTOM_PRODUCT_CANNOT_USE_DELIVERY_POOL",
      "Custom form products should not be connected to a delivery pool",
    );
  }

  if (input.type === "INSTANT_DELIVERY" && !input.deliveryPoolId) {
    throw badRequest(
      "DELIVERY_POOL_REQUIRED",
      "Instant delivery products must be connected to a delivery pool",
    );
  }

  if (input.type === "INSTANT_DELIVERY" && input.fields?.length) {
    throw badRequest(
      "INSTANT_PRODUCT_CANNOT_USE_FORM_FIELDS",
      "Instant delivery products cannot define custom form fields",
    );
  }
}
