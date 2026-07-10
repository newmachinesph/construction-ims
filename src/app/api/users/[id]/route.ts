import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { roleEnum, users } from "@/db/schema";

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

const updateUserSchema = z.object({
  role: z.enum(roleEnum.enumValues).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  await requirePermission("user:write");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateUserSchema);
  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(safeUserColumns);
  if (!updated) throw new NotFoundError("User");
  return ok(updated);
});
