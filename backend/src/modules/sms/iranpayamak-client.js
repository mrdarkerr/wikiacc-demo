import { badGateway } from "../../shared/errors.js";
import { IRANPAYAMAK_PATTERN_ENDPOINT } from "./constants.js";

function providerMessages(payload) {
  if (!payload || payload.messages === undefined || payload.messages === null) {
    return undefined;
  }
  return payload.messages;
}

export class IranPayamakClient {
  constructor({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 10_000 }) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async sendPattern({
    attributes,
    lineNumber,
    numberFormat,
    patternCode,
    recipient,
    schedule,
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;

    try {
      response = await this.fetchImpl(IRANPAYAMAK_PATTERN_ENDPOINT, {
        body: JSON.stringify({
          attributes,
          code: patternCode,
          line_number: lineNumber,
          number_format: numberFormat,
          recipient,
          ...(schedule ? { schedule } : {}),
        }),
        headers: {
          Accept: "application/json",
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });
    } catch (error) {
      throw badGateway(
        "SMS_PROVIDER_UNAVAILABLE",
        error?.name === "AbortError"
          ? "SMS provider request timed out"
          : "SMS provider is unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    let payload;
    try {
      const responseText = await response.text();
      payload = responseText ? JSON.parse(responseText) : undefined;
    } catch {
      throw badGateway(
        "SMS_PROVIDER_INVALID_RESPONSE",
        "SMS provider returned an invalid response",
        { providerStatus: response.status },
      );
    }

    if (!response.ok || payload?.status !== "success") {
      throw badGateway(
        "SMS_PROVIDER_REJECTED",
        "SMS provider rejected the pattern message",
        {
          messages: providerMessages(payload),
          providerStatus: response.status,
        },
      );
    }

    return payload;
  }
}
