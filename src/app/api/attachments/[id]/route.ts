import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { handler, ok } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { writeAudit } from "@/lib/services/ledger";
import { ATTACHMENT_ENTITIES, isAttachmentEntity } from "@/lib/attachments";
import { deleteObject } from "@/lib/r2";

/** Delete an attachment (row + R2 object). Gated by the entity's write perm. */
export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params;

  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
  if (!row) throw new NotFoundError("Attachment");

  const perm = isAttachmentEntity(row.entity) ? ATTACHMENT_ENTITIES[row.entity].write : "settings:write";
  const actor = await requirePermission(perm);

  await deleteObject(row.objectKey);
  await db.delete(attachments).where(eq(attachments.id, id));

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ATTACHMENT_DELETE",
    entity: row.entity,
    entityId: row.entityId,
    before: { attachmentId: row.id, name: row.originalName },
  });

  return ok({ id });
});
