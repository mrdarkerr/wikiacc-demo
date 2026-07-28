import { describe, expect, it, vi } from "vitest";

import { createJibitClient } from "../src/modules/payments/jibit-client.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("Jibit PPG v3 client", () => {
  it("authenticates, creates, verifies and inquires using the documented endpoints", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: "test-access-token", refreshToken: "refresh" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          purchaseId: 123456,
          purchaseIdStr: "123456",
          pspSwitchingUrl:
            "https://napi.jibit.ir/ppg/v3/purchases/123456/payments",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "SUCCESSFUL" }))
      .mockResolvedValueOnce(
        jsonResponse({
          elements: [
            {
              amount: 1250,
              clientReferenceNumber: "WKA-test",
              purchaseId: 123456,
              status: "SUCCESSFUL",
            },
          ],
        }),
      );
    const client = createJibitClient({
      apiKey: "api-key",
      baseUrl: "https://napi.jibit.ir/ppg/v3/",
      fetchImpl,
      secretKey: "secret-key",
    });

    await expect(
      client.createPurchase({
        amount: 1250,
        callbackUrl: "https://wikiacc.ir/api/v1/payments/jibit/callback",
        clientReferenceNumber: "WKA-test",
        currency: "IRR",
        userIdentifier: "09120000000",
      }),
    ).resolves.toEqual({
      purchaseId: "123456",
      redirectUrl: "https://napi.jibit.ir/ppg/v3/purchases/123456/payments",
    });
    await expect(client.verifyPurchase("123456")).resolves.toEqual({
      status: "SUCCESSFUL",
    });
    await expect(client.getPurchase("123456")).resolves.toMatchObject({
      amount: 1250,
      clientReferenceNumber: "WKA-test",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://napi.jibit.ir/ppg/v3/tokens");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      apiKey: "api-key",
      secretKey: "secret-key",
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      "https://napi.jibit.ir/ppg/v3/purchases",
    );
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer test-access-token",
    );
    expect(fetchImpl.mock.calls[2][0]).toBe(
      "https://napi.jibit.ir/ppg/v3/purchases/123456/verify",
    );
    expect(fetchImpl.mock.calls[3][0]).toBe(
      "https://napi.jibit.ir/ppg/v3/purchases?purchaseId=123456",
    );
  });

  it("rejects a non-HTTPS provider redirect URL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ accessToken: "test-access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          purchaseIdStr: "123456",
          pspSwitchingUrl: "javascript:alert(1)",
        }),
      );
    const client = createJibitClient({
      apiKey: "api-key",
      baseUrl: "https://napi.jibit.ir/ppg/v3",
      fetchImpl,
      secretKey: "secret-key",
    });

    await expect(
      client.createPurchase({ amount: 1250 }),
    ).rejects.toMatchObject({ code: "JIBIT_PURCHASE_INVALID" });
  });

  it("refreshes authentication once after an unauthorized provider response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ accessToken: "expired-token" }))
      .mockResolvedValueOnce(jsonResponse({ errors: [] }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ status: "SUCCESSFUL" }));
    const client = createJibitClient({
      apiKey: "api-key",
      baseUrl: "https://napi.jibit.ir/ppg/v3",
      fetchImpl,
      secretKey: "secret-key",
    });

    await expect(client.verifyPurchase("42")).resolves.toEqual({
      status: "SUCCESSFUL",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[3][1].headers.Authorization).toBe(
      "Bearer fresh-token",
    );
  });
});
