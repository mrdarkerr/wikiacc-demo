import { z } from "zod";

export const productTypeSchema = z.enum(["CUSTOM_FORM", "INSTANT_DELIVERY", "SHAREBOX"]);
export const fieldTypeSchema = z.enum(["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT"]);

export const productFieldInputSchema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().trim().min(1).max(160),
  type: fieldTypeSchema.default("TEXT"),
  required: z.boolean().default(false),
  optionsJson: z.string().trim().optional(),
  sortOrder: z.number().int().default(0),
});

export const productFeatureInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().default(0),
});

const productInputSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  type: productTypeSchema,
  price: z.number().int().nonnegative().max(2147483647).optional(),
  priceCurrency: z.enum(["TOMAN", "USD"]).optional(),
  basePrice: z.union([z.string().trim().min(1).max(24), z.number().nonnegative()]).optional(),
  profit: z.union([z.string().trim().max(32), z.number().nonnegative()]).optional(),
  categoryId: z.string().optional(),
  deliveryPoolId: z.string().nullable().optional(),
  shareboxCategoryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  features: z.array(productFeatureInputSchema).max(12).default([]),
  fields: z.array(productFieldInputSchema).default([]),
});

export const createProductSchema = productInputSchema.refine(
  (input) => input.price !== undefined || input.basePrice !== undefined,
  { message: "price or basePrice is required", path: ["basePrice"] },
);

export const updateProductSchema = productInputSchema
  .partial()
  .extend({
    features: z.array(productFeatureInputSchema).max(12).optional(),
    fields: z.array(productFieldInputSchema).optional(),
  });

export const createCategorySchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();
