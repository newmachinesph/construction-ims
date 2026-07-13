import { z } from "zod";
import { eq } from "drizzle-orm";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePermission } from "@/lib/auth/dal";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { db } from "@/db";
import { users } from "@/db/schema";
import { roleExists } from "@/lib/services/roles";
import { emailSchema, uuidSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/services/ledger";

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
  fullName: z.string().trim().min(1).max(160).optional(),
  email: emailSchema.optional(),
  role: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const actor = await requirePermission("user:write");
  const { id } = await ctx.params;
  const userId = uuidSchema.parse(id);
  const body = await parseBody(req, updateUserSchema);

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw new NotFoundError("User");

  // The administrator's role is fixed. Demoting the admin — including an admin
  // demoting themselves by mistake — can leave nobody able to grant roles back,
  // and there is no password-reset or recovery flow to dig out of that.
  if (target.role === "ADMIN" && body.role && body.role !== "ADMIN") {
    throw new ForbiddenError("The administrator's role cannot be changed.");
  }
  if (target.role === "ADMIN" && body.isActive === false) {
    throw new ForbiddenError("The administrator cannot be deactivated.");
  }
  if (target.id === actor.id && body.isActive === false) {
    throw new ForbiddenError("You cannot deactivate your own account.");
  }
  if (body.role && body.role !== target.role && !(await roleExists(body.role))) {
    throw new BusinessRuleError(`Unknown role: ${body.role}`);
  }

  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(safeUserColumns);

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "USER_UPDATE",
    entity: "user",
    entityId: userId,
    before: {
      fullName: target.fullName,
      email: target.email,
      role: target.role,
      isActive: target.isActive,
    },
    after: {
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    },
  });

  return ok(updated);
});
