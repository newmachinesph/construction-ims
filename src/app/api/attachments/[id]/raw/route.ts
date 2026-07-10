import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { fail } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { ATTACHMENT_ENTITIES, isAttachmentEntity } from "@/lib/attachments";
import { getObject } from "@/lib/r2";

/**
 * Stream an attachment's bytes to a logged-in user with read access to the
 * owning entity. Not wrapped in `handler` because it returns raw image bytes,
 * not the JSON envelope. `private` cache: never store business photos in a
 * shared cache.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
    if (!row) throw new NotFoundError("Attachment");

    const perm = isAttachmentEntity(row.entity) ? ATTACHMENT_ENTITIES[row.entity].read : "audit:read";
    await requirePermission(perm);

    const obj = await getObject(row.objectKey);
    if (!obj) throw new NotFoundError("File");

    return new NextResponse(Buffer.from(obj.body), {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.body.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
