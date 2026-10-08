import { describe, expect, it } from "../backend/node_modules/vitest";
import { checkoutWalletBalance } from "../lib/checkout";

describe("wallet balance after a confirmed checkout", () => {
  it("marks malformed balances as unknown instead of inventing a zero balance", () => {
    for (const value of [null, {}, { wallet: null }, { wallet: { balance: "100" } }, { wallet: { balance: -1 } }, { wallet: { balance: 1.5 } }, { wallet: { balance: 2147483648 } }]) {
      expect(checkoutWalletBalance(value)).toBeNull();
    }
  });
  it("reads the actual server balance including zero instead of subtracting locally", () => {
    expect(checkoutWalletBalance).toBeTypeOf("function");
    expect(checkoutWalletBalance({ wallet: { balance: 0 } })).toBe(0);
    expect(checkoutWalletBalance({ wallet: { balance: 8107182 } })).toBe(8107182);
  });
});
