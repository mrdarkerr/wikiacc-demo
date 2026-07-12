import { z } from "zod";

export const productTypeSchema = z.enum(["CUSTOM_FORM", "INSTANT_DELIVERY"]);
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

export const createProductSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  type: productTypeSchema,
  price: z.number().int().nonnegative(),
  categoryId: z.string().optional(),
  deliveryPoolId: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  features: z.array(productFeatureInputSchema).max(12).default([]),
  fields: z.array(productFieldInputSchema).default([]),
});

export const updateProductSchema = createProductSchema
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
