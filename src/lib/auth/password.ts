import bcrypt from "bcryptjs";

/**
 * bcrypt cost. 12 ≈ 250ms on a modern server — slow enough to make offline
 * cracking expensive, fast enough that a login does not feel broken.
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Burn the same CPU as a real verify when the email does not exist, so an
 * attacker cannot enumerate accounts by timing the response.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.HqYlfLQvW1mVCkKjKZUOhvqXpmQwvR.";

export function fakeVerify(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/** Minimum viable policy. Length beats character-class theatre. */
export function checkPasswordPolicy(plain: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (plain.length < 12) errors.push("Password must be at least 12 characters.");
  if (plain.length > 128) errors.push("Password must be at most 128 characters.");
  if (!/[a-zA-Z]/.test(plain)) errors.push("Password must contain a letter.");
  if (!/\d/.test(plain)) errors.push("Password must contain a number.");
  return { ok: errors.length === 0, errors };
}
