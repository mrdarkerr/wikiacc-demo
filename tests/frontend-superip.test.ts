import { describe, it, expect } from "vitest";
import {
  walletCreditInput,
  orderNeedsFulfillmentPolling,
} from "../lib/superip";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SuperipOrderStatus } from "../components/superip-order-status";
import type { Order } from "../types/api";
it("renders terminal order states before pending wallet state", () => {
  const order = { paymentStatus: "PAID", status: "CANCELLED", items: [{id:"item",priceSnapshot:1000,productTypeSnapshot:"SUPERIP_WALLET",superipFulfillment:{username:"agent.one",amount:1000,status:"PENDING"}}]} as Order;
  expect(renderToStaticMarkup(createElement(SuperipOrderStatus,{order}))).toContain("سفارش لغو شده است");
  expect(renderToStaticMarkup(createElement(SuperipOrderStatus,{order:{...order,status:"REFUNDED",paymentStatus:"REFUNDED"}}))).toContain("مبلغ سفارش بازپرداخت شده است");
});
describe("wallet credit checkout", () => {
  it("enforces the selected product minimum including Persian amounts", () => {
    expect(walletCreditInput("agent.one", "۱۹۹۹۹۹۹", 2000000)).toBeNull();
    expect(walletCreditInput("agent.one", "۲۰۰۰۰۰۰", 2000000)).toEqual({username:"agent.one",amount:2000000});
    expect(walletCreditInput("agent.one", "200000000", 2000000)?.amount).toBe(200000000);
  });
  it("normalizes user input and rejects fractional or out of bounds amounts", () => {
    expect(walletCreditInput("Agent.One", "۱۲۰۰۰")).toEqual({
      username: "agent.one",
      amount: 12000,
    });
    for (const amount of ["0", "1.5", "200000001", "abc", "1e4"])
      expect(walletCreditInput("agent.one", amount)).toBeNull();
    expect(walletCreditInput("bad user", "1000")).toBeNull();
  });
  it("polls only paid pending wallet fulfillment", () => {
    const order = {
      paymentStatus: "PAID",
      status: "READY",
      items: [
        {
          productTypeSnapshot: "SUPERIP_WALLET",
          superipFulfillment: { status: "RETRY" },
        },
      ],
    } as Order;
    expect(orderNeedsFulfillmentPolling(order)).toBe(true);
    expect(
      orderNeedsFulfillmentPolling({ ...order, paymentStatus: "UNPAID" }),
    ).toBe(false);
    expect(
      orderNeedsFulfillmentPolling({ ...order, status: "CANCELLED" }),
    ).toBe(false);
    expect(
      orderNeedsFulfillmentPolling({
        ...order,
        items: [
          {
            ...order.items[0],
            superipFulfillment: {
              ...order.items[0].superipFulfillment!,
              status: "REVIEW_REQUIRED",
            },
          },
        ],
      }),
    ).toBe(false);
  });
});
