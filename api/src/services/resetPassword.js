import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import User from "../models/User.js";

export async function resetPassword(email) {
  const password = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
    { runValidators: true },
  );
  return result.modifiedCount === 1 ? password : null;
}
