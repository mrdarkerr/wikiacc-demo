import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { env } from "../../config/env.js";
import {
  AppError,
  badRequest,
  conflict,
  notFound,
  tooManyRequests,
  unauthorized,
} from "../../shared/errors.js";
import { sendAuthCodeSms } from "../sms/service.js";
import {
  findAuthUserById,
  findUserByEmail,
  findUserByIdentifier,
  findUserByPhone,
  markOtpChallengeSent,
  removeOtpChallenge,
  reserveOtpChallenge,
} from "./repository.js";
import {
  generateOtpCode,
  hashOtpCode,
  hashRequestIp,
  maskPhone,
  otpCodeMatches,
} from "./security.js";
import { authUserSelect } from "./schemas.js";

export const OTP_POLICY = Object.freeze({
  ipHourly: 20,
  maxAttempts: 5,
  phoneDaily: 10,
  phoneHourly: 5,
  ttlSeconds: 60,
});

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser, hasPassword: Boolean(passwordHash) };
}

function otpRateLimitError(reservation) {
  const isActive = reservation.status === "active";
  return tooManyRequests(
    isActive ? "OTP_ALREADY_SENT" : "OTP_RATE_LIMITED",
    isActive
      ? "A valid verification code has already been sent"
      : "Too many verification codes have been requested",
    { retryAfterSeconds: reservation.retryAfterSeconds },
  );
}

async function resolveOtpPurpose(prisma, input) {
  const existingUser = await findUserByPhone(prisma, input.phone);

  if (input.mode === "login") {
    if (!existingUser) {
      throw notFound(
        "AUTH_ACCOUNT_NOT_FOUND",
        "No account exists for this phone number",
      );
    }
    return { purpose: "LOGIN" };
  }

  if (input.mode === "checkout" && existingUser) {
    return { purpose: "LOGIN" };
  }

  if (input.mode === "register" && existingUser) {
    throw conflict(
      "PHONE_ALREADY_EXISTS",
      "An account with this phone number already exists",
    );
  }

  if (input.email) {
    const emailOwner = await findUserByEmail(prisma, input.email);
    if (emailOwner) {
      throw conflict(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists",
      );
    }
  }

  return {
    purpose: "REGISTER",
    registrationEmail: input.email,
    registrationName: input.name,
  };
}

export async function requestOtp(prisma, input, context = {}) {
  const resolved = await resolveOtpPurpose(prisma, input);
  const now = context.now ?? new Date();
  const challengeId = randomUUID();
  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_POLICY.ttlSeconds * 1000);
  const requestIpHash = hashRequestIp(context.ip, env.JWT_SECRET);
  const codeHash = hashOtpCode({
    challengeId,
    code,
    phone: input.phone,
    secret: env.JWT_SECRET,
  });

  const reservation = await reserveOtpChallenge(
    prisma,
    {
      codeHash,
      expiresAt,
      id: challengeId,
      now,
      phone: input.phone,
      purpose: resolved.purpose,
      registrationEmail: resolved.registrationEmail,
      registrationName: resolved.registrationName,
      requestIpHash,
    },
    OTP_POLICY,
  );

  if (reservation.status !== "created") {
    throw otpRateLimitError(reservation);
  }

  try {
    const sendCode = context.sendCode ?? sendAuthCodeSms;
    await sendCode(
      prisma,
      { code, recipient: input.phone },
      context.smsOptions,
    );
    const sentAt = context.sentAt ?? new Date();
    const sentExpiresAt = new Date(
      sentAt.getTime() + OTP_POLICY.ttlSeconds * 1000,
    );
    await markOtpChallengeSent(prisma, challengeId, sentAt, sentExpiresAt);
    expiresAt.setTime(sentExpiresAt.getTime());
  } catch (error) {
    await removeOtpChallenge(prisma, challengeId);
    throw error;
  }

  return {
    challengeId,
    expiresAt,
    maskedPhone: maskPhone(input.phone),
    retryAfterSeconds: OTP_POLICY.ttlSeconds,
  };
}

function verificationError(result) {
  if (result.status === "invalid") {
    return new AppError(401, "OTP_INVALID", "Verification code is incorrect", {
      attemptsRemaining: result.attemptsRemaining,
    });
  }
  if (result.status === "locked") {
    return new AppError(
      401,
      "OTP_ATTEMPTS_EXCEEDED",
      "Verification code is no longer valid",
    );
  }
  return badRequest(
    "OTP_EXPIRED",
    "Verification code is expired or no longer valid",
  );
}

export async function verifyOtp(prisma, input, context = {}) {
  const now = context.now ?? new Date();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.authOtpChallenge.findUnique({
        where: { id: input.challengeId },
      });

      if (!challenge || challenge.consumedAt || challenge.invalidatedAt) {
        return { status: "expired" };
      }
      if (!challenge.sentAt || challenge.expiresAt <= now) {
        await tx.authOtpChallenge.update({
          where: { id: challenge.id },
          data: { invalidatedAt: now },
        });
        return { status: "expired" };
      }

      const matches = otpCodeMatches({
        challengeId: challenge.id,
        code: input.code,
        phone: challenge.phone,
        secret: env.JWT_SECRET,
        storedHash: challenge.codeHash,
      });

      if (!matches) {
        const updatedChallenge = await tx.authOtpChallenge.update({
          where: { id: challenge.id },
          data: { failedAttempts: { increment: 1 } },
        });
        const failedAttempts = updatedChallenge.failedAttempts;
        const locked = failedAttempts >= OTP_POLICY.maxAttempts;
        if (locked) {
          await tx.authOtpChallenge.update({
            where: { id: challenge.id },
            data: { invalidatedAt: now },
          });
        }
        return {
          attemptsRemaining: Math.max(
            0,
            OTP_POLICY.maxAttempts - failedAttempts,
          ),
          status: locked ? "locked" : "invalid",
        };
      }

      const claim = await tx.authOtpChallenge.updateMany({
        where: {
          consumedAt: null,
          expiresAt: { gt: now },
          id: challenge.id,
          invalidatedAt: null,
        },
        data: { consumedAt: now },
      });
      if (claim.count !== 1) {
        return { status: "expired" };
      }

      let user = await tx.user.findUnique({
        where: { phone: challenge.phone },
        select: authUserSelect,
      });

      if (challenge.purpose === "REGISTER" && !user) {
        if (challenge.registrationEmail) {
          const emailOwner = await tx.user.findUnique({
            where: { email: challenge.registrationEmail },
            select: { id: true },
          });
          if (emailOwner) {
            await tx.authOtpChallenge.update({
              where: { id: challenge.id },
              data: { invalidatedAt: now },
            });
            return { status: "email_conflict" };
          }
        }

        user = await tx.user.create({
          data: {
            email: challenge.registrationEmail,
            name: challenge.registrationName,
            passwordHash: null,
            phone: challenge.phone,
            wallet: { create: { balance: 0 } },
          },
          select: authUserSelect,
        });
      }

      if (!user) {
        await tx.authOtpChallenge.update({
          where: { id: challenge.id },
          data: { invalidatedAt: now },
        });
        return { status: "account_not_found" };
      }

      return { status: "success", user };
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflict(
        "AUTH_ACCOUNT_CONFLICT",
        "This phone number or email is already in use",
      );
    }
    throw error;
  }

  if (result.status === "email_conflict") {
    throw conflict(
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists",
    );
  }
  if (result.status === "account_not_found") {
    throw notFound(
      "AUTH_ACCOUNT_NOT_FOUND",
      "No account exists for this phone number",
    );
  }
  if (result.status !== "success") {
    throw verificationError(result);
  }
  return publicUser(result.user);
}

export async function loginUser(prisma, input) {
  const user = await findUserByIdentifier(prisma, input.identifier);
  if (!user?.passwordHash) {
    throw unauthorized("Invalid phone number, email, or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw unauthorized("Invalid phone number, email, or password");
  }

  return publicUser(await findAuthUserById(prisma, user.id));
}

export async function setUserPassword(prisma, userId, input) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("USER_NOT_FOUND", "User was not found");

  if (user.passwordHash) {
    if (!input.currentPassword) {
      throw badRequest(
        "CURRENT_PASSWORD_REQUIRED",
        "Current password is required",
      );
    }
    const currentMatches = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new AppError(
        401,
        "CURRENT_PASSWORD_INVALID",
        "Current password is incorrect",
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: authUserSelect,
  });
  return publicUser(updated);
}

export async function updateUserProfile(prisma, userId, input) {
  if (input.email) {
    const owner = await findUserByEmail(prisma, input.email);
    if (owner && owner.id !== userId) {
      throw conflict(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists",
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: authUserSelect,
    });
    return publicUser(updated);
  } catch (error) {
    if (error?.code === "P2025") {
      throw notFound("USER_NOT_FOUND", "User was not found");
    }
    throw error;
  }
}
