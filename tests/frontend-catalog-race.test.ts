import { beforeEach, describe, expect, it } from "../backend/node_modules/vitest";
declare const vi: typeof import("../backend/node_modules/vitest").vi;
import type { Product } from "../types/api";

// Exercise the real hook callbacks with state slots; no DOM dependency is needed.
// Browser QA separately covers React lifecycle and the visible checkout flow.
const probe = vi.hoisted(() => ({ slots: [] as unknown[] }));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const index = probe.slots.push(initial) - 1;
    return [initial, (next: unknown) => {
      probe.slots[index] = typeof next === "function" ? next(probe.slots[index]) : next;
    }];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}));
import { api } from "../lib/api";
import { usePublicProducts } from "../lib/use-public-products";

const product = (price: number) => ({ id: "quoted-product", price } as Product);

describe("catalog refresh versus checkout quote", () => {
  beforeEach(() => { probe.slots = []; });
  it("keeps checkout's newer price when an older catalog request finishes later", async () => {
    const list = vi.spyOn(api.catalog, "products");
    list.mockResolvedValueOnce({ products: [product(100000)] });
    const hook = usePublicProducts();
    await hook.refresh();
    let finish!: (result: { products: Product[] }) => void;
    const delayed = new Promise<{ products: Product[] }>((resolve) => { finish = resolve; });
    list.mockReturnValueOnce(delayed);
    const pending = hook.refresh();
    hook.replaceProduct(product(120000));
    finish({ products: [product(100000)] });
    await pending;
    expect((probe.slots[0] as Product[])[0].price).toBe(120000);
    expect(list.mock.calls[1][1]?.aborted).toBe(true);
    // A later, genuinely fresh poll must still be able to update the list.
    list.mockResolvedValueOnce({ products: [product(130000)] });
    await hook.refresh();
    expect((probe.slots[0] as Product[])[0].price).toBe(130000);
  });
});
