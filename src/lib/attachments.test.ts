import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ENTITIES,
  MAX_UPLOAD_BYTES,
  buildObjectKey,
  extForType,
  isAttachmentEntity,
  validateUpload,
} from "./attachments";

describe("object keys", () => {
  it("builds entity/entityId/uuid.ext", () => {
    const key = buildObjectKey("goods_receipt", "abc-123", "image/png");
    expect(key).toMatch(/^goods_receipt\/abc-123\/[0-9a-f-]{36}\.png$/);
  });

  it("strips unsafe characters from entity and id", () => {
    const key = buildObjectKey("../evil", "a/b?c", "image/jpeg");
    expect(key.startsWith("evil/abc/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key).not.toContain("?");
  });

  it("maps content types to extensions, defaulting to bin", () => {
    expect(extForType("image/jpeg")).toBe("jpg");
    expect(extForType("image/webp")).toBe("webp");
    expect(extForType("application/zip")).toBe("bin");
  });
});

describe("upload validation", () => {
  it("accepts a normal image", () => {
    expect(validateUpload("image/png", 1024).ok).toBe(true);
  });
  it("rejects non-images", () => {
    expect(validateUpload("application/pdf", 1024).ok).toBe(false);
  });
  it("rejects empty and oversize files", () => {
    expect(validateUpload("image/png", 0).ok).toBe(false);
    expect(validateUpload("image/png", MAX_UPLOAD_BYTES + 1).ok).toBe(false);
  });
});

describe("entity guard", () => {
  it("recognizes configured entities only", () => {
    expect(isAttachmentEntity("item")).toBe(true);
    expect(isAttachmentEntity("goods_receipt")).toBe(true);
    expect(isAttachmentEntity("users")).toBe(false);
  });
  it("gates each entity behind its own permission", () => {
    expect(ATTACHMENT_ENTITIES.goods_receipt.write).toBe("grn:create");
    expect(ATTACHMENT_ENTITIES.item.read).toBe("item:read");
  });
});
