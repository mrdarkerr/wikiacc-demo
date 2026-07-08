import bcrypt from "bcryptjs";

import { conflict, unauthorized } from "../../shared/errors.js";
import { createUser, findPublicUserById, findUserByEmail } from "./repository.js";

export async function registerUser(prisma, input) {
  const existing = await findUserByEmail(prisma, input.email);
  if (existing) {
    throw conflict("EMAIL_ALREADY_EXISTS", "A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  return createUser(prisma, { ...input, passwordHash });
}

export async function loginUser(prisma, input) {
  const user = await findUserByEmail(prisma, input.email);
  if (!user) {
    throw unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw unauthorized("Invalid email or password");
  }

  return findPublicUserById(prisma, user.id);
}
