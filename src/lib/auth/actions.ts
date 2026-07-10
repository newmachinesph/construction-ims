"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fakeVerify, verifyPassword } from "./password";
import {
  createSession,
  destroySession,
  setSessionCookie,
} from "./session";
import { writeAudit } from "@/lib/services/ledger";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export interface LoginState {
  error?: string;
}

/**
 * Login server action for use with useActionState.
 *
 * Defends against: user enumeration (constant-time fake verify + identical
 * error message), brute force (per-account lockout after 5 failures), and
 * session fixation (a fresh opaque token is minted on every login).
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password." };

  const { email, password } = parsed.data;
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = hdrs.get("user-agent");

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Always spend hashing time so a missing account is indistinguishable.
  if (!user) {
    await fakeVerify(password);
    return { error: "Invalid email or password." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Spend the same hashing time as a real verify so the locked path isn't
    // distinguishable by response latency (timing-based account enumeration).
    await fakeVerify(password);
    return { error: "Account temporarily locked. Try again later." };
  }
  if (!user.isActive) {
    await fakeVerify(password);
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    return { error: "Invalid email or password." };
  }

  // Success: reset counters, mint session.
  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const { token, expiresAt } = await createSession(user.id, { ipAddress: ip, userAgent: ua });
  await setSessionCookie(token, expiresAt);
  await writeAudit(db, {
    actorId: user.id,
    actorEmail: user.email,
    action: "LOGIN",
    entity: "user",
    entityId: user.id,
    ipAddress: ip,
  });

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
