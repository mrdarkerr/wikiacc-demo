import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode({ challengeId, code, phone, secret }) {
  return createHmac("sha256", secret)
    .update(`${challengeId}:${phone}:${code}`)
    .digest("hex");
}

export function otpCodeMatches({ challengeId, code, phone, secret, storedHash }) {
  const candidate = Buffer.from(
    hashOtpCode({ challengeId, code, phone, secret }),
    "hex",
  );
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function hashRequestIp(ip, secret) {
  return createHmac("sha256", secret).update(ip || "unknown").digest("hex");
}

export function maskPhone(phone) {
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
