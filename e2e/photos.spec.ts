/* eslint-disable @typescript-eslint/no-explicit-any -- test glue reads dynamic API JSON */
import { expect, test } from "@playwright/test";
import { USERS, contextFor, expectOk } from "./helpers";

// Smallest valid PNG (1x1 transparent pixel).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("upload a delivery photo to a GRN, view it, then delete it", async ({ browser }) => {
  const bodega = await contextFor(browser, USERS.bodega);
  try {
    const grns = (await expectOk(await bodega.page.request.get("/api/goods-receipts"))) as any[];
    test.skip(grns.length === 0, "no goods receipts seeded — run flow.spec first");
    const grnId = grns[0].id;

    // Upload through the real API (round-trips to Cloudflare R2).
    const uploadRes = await bodega.page.request.post("/api/attachments", {
      multipart: {
        entity: "goods_receipt",
        entityId: grnId,
        file: { name: "delivery.png", mimeType: "image/png", buffer: PNG_1x1 },
      },
    });
    test.skip(uploadRes.status() === 422, "R2 not configured in this environment");
    const attachment = await expectOk(uploadRes);
    expect(attachment.contentType).toBe("image/png");
    expect(attachment.url).toContain("/api/attachments/");

    // It appears in the list.
    const list = (await expectOk(
      await bodega.page.request.get(`/api/attachments?entity=goods_receipt&entityId=${grnId}`),
    )) as any[];
    expect(list.some((a) => a.id === attachment.id)).toBe(true);

    // The auth-gated raw route streams the bytes back as an image.
    const raw = await bodega.page.request.get(attachment.url);
    expect(raw.status()).toBe(200);
    expect(raw.headers()["content-type"]).toContain("image/png");
    expect((await raw.body()).byteLength).toBeGreaterThan(0);

    // Clean up.
    await expectOk(await bodega.page.request.delete(`/api/attachments/${attachment.id}`));
  } finally {
    await bodega.context.close();
  }
});

test("a viewer cannot upload a photo", async ({ browser }) => {
  const viewer = await contextFor(browser, USERS.viewer);
  try {
    const res = await viewer.page.request.post("/api/attachments", {
      multipart: {
        entity: "goods_receipt",
        entityId: "00000000-0000-0000-0000-000000000000",
        file: { name: "x.png", mimeType: "image/png", buffer: PNG_1x1 },
      },
    });
    // Forbidden (no grn:create) — never 2xx.
    expect(res.status()).toBe(403);
  } finally {
    await viewer.context.close();
  }
});
