import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { requirePermission, requireUser } from "@/lib/auth/dal";
import { created, handler, ok } from "@/lib/api";
import { BusinessRuleError, ValidationError } from "@/lib/errors";
import { writeAudit } from "@/lib/services/ledger";
import {
  ATTACHMENT_ENTITIES,
  attachmentUrl,
  buildObjectKey,
  isAttachmentEntity,
  validateUpload,
} from "@/lib/attachments";
import { isR2Configured, putObject } from "@/lib/r2";
import { uuidSchema } from "@/lib/validation";

/** List attachments for a record: /api/attachments?entity=item&entityId=<uuid> */
export const GET = handler(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "";
  const entityId = url.searchParams.get("entityId") ?? "";

  if (!isAttachmentEntity(entity)) throw new ValidationError("Unknown attachment entity.");
  uuidSchema.parse(entityId);
  await requirePermission(ATTACHMENT_ENTITIES[entity].read);

  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.entity, entity), eq(attachments.entityId, entityId)))
    .orderBy(desc(attachments.createdAt));

  return ok(rows.map((r) => ({ ...r, url: attachmentUrl(r.id) })));
});

/** Upload a photo (multipart/form-data: entity, entityId, file). */
export const POST = handler(async (req) => {
  if (!isR2Configured()) throw new BusinessRuleError("File storage (R2) is not configured.");

  const form = await req.formData().catch(() => {
    throw new ValidationError("Expected multipart/form-data.");
  });

  const entity = String(form.get("entity") ?? "");
  const entityId = String(form.get("entityId") ?? "");
  const file = form.get("file");

  if (!isAttachmentEntity(entity)) throw new ValidationError("Unknown attachment entity.");
  uuidSchema.parse(entityId);
  const actor = await requirePermission(ATTACHMENT_ENTITIES[entity].write);

  if (!(file instanceof File)) throw new ValidationError("Missing file.");
  const check = validateUpload(file.type, file.size);
  if (!check.ok) throw new ValidationError(check.error!);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const objectKey = buildObjectKey(entity, entityId, file.type);
  await putObject(objectKey, bytes, file.type);

  const [row] = await db
    .insert(attachments)
    .values({
      entity,
      entityId,
      objectKey,
      contentType: file.type,
      sizeBytes: bytes.byteLength,
      originalName: file.name?.slice(0, 255) ?? null,
      uploadedBy: actor.id,
    })
    .returning();

  await writeAudit(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ATTACHMENT_UPLOAD",
    entity,
    entityId,
    after: { attachmentId: row.id, name: row.originalName },
  });

  return created({ ...row, url: attachmentUrl(row.id) });
});
