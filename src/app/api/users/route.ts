import { z } from "zod";
import { created, handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { db } from "@/db";
import { users } from "@/db/schema";
import { BusinessRuleError } from "@/lib/errors";
import { roleExists } from "@/lib/services/roles";
import { emailSchema } from "@/lib/validation";

/** Never expose the password hash. */
const safeUserColumns = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  role: users.role,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const;

const createUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(40),
  password: z.string().superRefine((plain, ctx) => {
    const result = checkPasswordPolicy(plain);
    if (!result.ok) {
      for (const message of result.errors) ctx.addIssue({ code: "custom", message });
    }
  }),
});

export const GET = handler(async () => {
  await requirePermission("user:read");
  const rows = await db.query.users.findMany({
    columns: { passwordHash: false },
    orderBy: (t, { asc }) => asc(t.fullName),
  });
  return ok(rows);
});

export const POST = handler(async (req) => {
  await requirePermission("user:write");
  const body = await parseBody(req, createUserSchema);
  if (!(await roleExists(body.role))) {
    throw new BusinessRuleError(`Unknown role: ${body.role}`);
  }
  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({ email: body.email, fullName: body.fullName, role: body.role, passwordHash })
    .returning(safeUserColumns);
  return created(user);
});
