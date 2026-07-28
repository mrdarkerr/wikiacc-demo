import { badGateway, serviceUnavailable } from "../../shared/errors.js";

const TOKEN_SAFETY_WINDOW_MS = 60_000;
const DEFAULT_TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

function parseBody(response, text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw badGateway("JIBIT_INVALID_RESPONSE", "Jibit returned an invalid response");
  }
}

function providerErrorCode(body) {
  const code = body?.errors?.[0]?.code;
  return typeof code === "string" ? code : undefined;
}

function tokenExpiration(accessToken) {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return Date.now() + DEFAULT_TOKEN_TTL_MS;
    }
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded.exp === "number"
      ? decoded.exp * 1000
      : Date.now() + DEFAULT_TOKEN_TTL_MS;
  } catch {
    return Date.now() + DEFAULT_TOKEN_TTL_MS;
  }
}

function asString(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function asHttpsUrl(value) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function createJibitClient({ apiKey, baseUrl, fetchImpl = fetch, secretKey }) {
  if (!apiKey || !secretKey) {
    return null;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  let cachedToken = null;
  let cachedTokenExpiresAt = 0;

  async function request(path, { auth = true, body, method = "GET", retry = true } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (auth) {
      headers.Authorization = `Bearer ${await accessToken()}`;
    }

    let response;
    try {
      response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw serviceUnavailable(
        "JIBIT_UNAVAILABLE",
        "Could not connect to Jibit",
        { cause: error?.name === "TimeoutError" ? "timeout" : "network" },
      );
    }

    const text = await response.text();
    const payload = parseBody(response, text);

    if (auth && response.status === 401 && retry) {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      return request(path, { auth, body, method, retry: false });
    }

    if (!response.ok) {
      throw badGateway("JIBIT_REQUEST_FAILED", "Jibit rejected the request", {
        providerCode: providerErrorCode(payload),
        providerStatus: response.status,
      });
    }

    return payload;
  }

  async function accessToken() {
    if (cachedToken && cachedTokenExpiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
      return cachedToken;
    }

    const result = await request("/tokens", {
      auth: false,
      body: { apiKey, secretKey },
      method: "POST",
    });
    if (typeof result.accessToken !== "string" || !result.accessToken) {
      throw badGateway("JIBIT_TOKEN_INVALID", "Jibit did not return an access token");
    }

    cachedToken = result.accessToken;
    cachedTokenExpiresAt = tokenExpiration(result.accessToken);
    return cachedToken;
  }

  return {
    async createPurchase(input) {
      const result = await request("/purchases", {
        body: input,
        method: "POST",
      });
      const purchaseId = asString(result.purchaseIdStr ?? result.purchaseId);
      const redirectUrl = asHttpsUrl(result.pspSwitchingUrl);
      if (!purchaseId || !redirectUrl) {
        throw badGateway(
          "JIBIT_PURCHASE_INVALID",
          "Jibit did not return a valid purchase",
        );
      }
      return {
        purchaseId,
        redirectUrl,
      };
    },

    async verifyPurchase(purchaseId) {
      return request(`/purchases/${encodeURIComponent(purchaseId)}/verify`);
    },

    async getPurchase(purchaseId) {
      const result = await request(
        `/purchases?purchaseId=${encodeURIComponent(purchaseId)}`,
      );
      const purchase = Array.isArray(result.elements) ? result.elements[0] : result;
      if (!purchase || typeof purchase !== "object") {
        throw badGateway(
          "JIBIT_INQUIRY_INVALID",
          "Jibit did not return the requested purchase",
        );
      }
      return purchase;
    },
  };
}
