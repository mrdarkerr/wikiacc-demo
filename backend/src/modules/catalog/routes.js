import { z } from "zod";

import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { getCategories, getProductBySlug, getProducts } from "./service.js";

const productListQuerySchema = z.object({
  category: z.string().optional(),
});

export async function catalogRoutes(app) {
  app.get("/categories", async (request, reply) => {
    const categories = await getCategories(app.prisma);
    return ok(reply, { categories });
  });

  app.get("/products", async (request, reply) => {
    const query = parse(productListQuerySchema, request.query);
    const products = await getProducts(app.prisma, {
      categorySlug: query.category,
    });
    return ok(reply, { products });
  });

  app.get("/products/:slug", async (request, reply) => {
    const params = parse(z.object({ slug: z.string() }), request.params);
    const product = await getProductBySlug(app.prisma, params.slug);
    return ok(reply, { product });
  });
}
