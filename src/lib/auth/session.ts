import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { roles, sessions, users } from "@/db/schema";
import type { Permission } from "@/lib/rbac";
import { SESSION_COOKIE } from "./session-cookie";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one construction shift + overtime
/** Slide the expiry when a session is used with less than this much life left. */
const REFRESH_THRESHOLD_MS = 6 * 60 * 60 * 1000;
/** Hard ceiling: no amount of sliding keeps a session alive past this from its
 *  creation, so a stolen-but-continuously-used cookie still dies within a month. */
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  /** The user's role key (a row in `roles`). */
  role: string;
  /** Display label for that role, resolved from the DB. */
  roleLabel: string;
  /** The role's permissions, resolved live on every request. Editing the role
   *  takes effect immediately — no re-login needed. */
  permissions: Permission[];
}

/** The cookie carries the raw token; the DB stores only its SHA-256. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the cookie to a live user. Returns null for missing, expired,
 * revoked, or deactivated-user sessions.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      roleLabel: roles.label,
      permissions: roles.permissions,
      isActive: users.isActive,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
      tokenHash: sessions.tokenHash,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.key, users.role))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;

  // Constant-time confirm — belt and braces over the indexed equality above.
  if (!safeEqualHex(row.tokenHash, hashToken(token))) return null;

  // Absolute cap: past ABSOLUTE_TTL_MS from creation the session is dead no matter
  // how recently it was used — sliding renewal never defeats this ceiling.
  const absoluteExpiry = row.createdAt.getTime() + ABSOLUTE_TTL_MS;
  if (Date.now() > absoluteExpiry) return null;

  if (row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    await slideExpiry(row.tokenHash, absoluteExpiry);
  }

  return {
    id: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    roleLabel: row.roleLabel,
    permissions: (row.permissions ?? []) as Permission[],
  };
}

async function slideExpiry(tokenHash: string, absoluteExpiry: number): Promise<void> {
  // Never slide past the absolute ceiling.
  const next = Math.min(Date.now() + SESSION_TTL_MS, absoluteExpiry);
  await db
    .update(sessions)
    .set({ expiresAt: new Date(next) })
    .where(eq(sessions.tokenHash, tokenHash));
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  await clearSessionCookie();
}

/** Kill every session for a user — used when deactivating or changing role. */
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping; safe to call on a schedule. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
