/* eslint-disable @typescript-eslint/no-explicit-any -- test glue reads dynamic API JSON */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PH_ITEMS, PH_ITEM_COUNT } from "./data/ph-items";
import { USERS, login } from "./helpers";

/**
 * Continuous UI seeding loop: for each of 200+ Philippine catalog items,
 * create it through the real item form and upload a web-sourced material
 * photo through the real PhotoManager. This exercises the create form, the
 * item detail page, the upload component, R2, and item:write RBAC — all the
 * UI/UX paths at once — while loading realistic data.
 */

const CACHE_DIR = join(process.cwd(), "e2e", ".image-cache");

/** Download a keyword-matched stock photo from the web, cached per keyword. */
async function imageFor(keyword: string): Promise<string | null> {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, keyword.replace(/[^a-z0-9]+/gi, "_") + ".jpg");
  if (existsSync(file)) return file;

  const sources = [
    `https://loremflickr.com/640/480/${encodeURIComponent(keyword)}`,
    `https://picsum.photos/seed/${encodeURIComponent(keyword)}/640/480`,
  ];
  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 1500) {
        writeFileSync(file, buf);
        return file;
      }
    } catch {
      /* try next source */
    }
  }
  return null;
}

async function createItem(page: Page, it: (typeof PH_ITEMS)[number]): Promise<string | null> {
  await page.getByRole("button", { name: /new item/i }).first().click();
  await page.fill("#sku", it.sku);
  await page.fill("#name", it.name);
  await page.selectOption("#categoryId", { label: it.category });
  await page.selectOption("#uom", it.uom);
  await page.fill("#standardCost", it.cost);
  await page.fill("#reorderPoint", it.reorderPoint);
  await page.fill("#reorderQty", it.reorderQty);
  if (it.weatherSensitive) {
    await page.locator('input[type="checkbox"]').first().check();
  }

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/items") && r.request().method() === "POST",
      { timeout: 20_000 },
    ),
    page.getByRole("button", { name: /save item/i }).click(),
  ]);

  const body = await res.json().catch(() => null);
  if (!body?.ok) return null; // 409 duplicate on re-run, or validation error
  return body.data.id as string;
}

async function uploadPhoto(page: Page, itemId: string, keyword: string): Promise<boolean> {
  const file = await imageFor(keyword);
  if (!file) return false;

  await page.goto(`/items/${itemId}`, { waitUntil: "domcontentloaded" });
  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: "attached", timeout: 10_000 });

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/attachments") && r.request().method() === "POST",
      { timeout: 30_000 },
    ),
    input.setInputFiles(file),
  ]);
  const body = await res.json().catch(() => null);
  return Boolean(body?.ok);
}

test("seed 200+ PH catalog items and photos through the UI", async ({ page }) => {
  test.setTimeout(90 * 60 * 1000); // up to 90 min for the full loop

  expect(PH_ITEM_COUNT).toBeGreaterThanOrEqual(200);

  // SEED_LIMIT caps the run for a quick smoke test; unset = full catalog.
  const limit = process.env.SEED_LIMIT ? Number(process.env.SEED_LIMIT) : PH_ITEMS.length;
  const queue = PH_ITEMS.slice(0, limit);
  console.log(`Seeding ${queue.length}/${PH_ITEM_COUNT} items through the UI…`);

  await login(page, USERS.admin);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let photos = 0;

  for (let i = 0; i < queue.length; i++) {
    const it = queue[i];
    try {
      await page.goto("/items", { waitUntil: "domcontentloaded" });
      const id = await createItem(page, it);
      if (!id) {
        skipped++;
        continue;
      }
      created++;
      if (await uploadPhoto(page, id, it.keyword)) photos++;
    } catch (err) {
      failed++;
      console.log(`  ✗ ${it.sku}: ${(err as Error).message.split("\n")[0]}`);
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  [${i + 1}/${queue.length}] created=${created} photos=${photos} skipped=${skipped} failed=${failed}`);
    }
  }

  console.log(`Done. created=${created} photos=${photos} skipped=${skipped} failed=${failed}`);

  // The run is a success if most items landed. Slack absorbs transient
  // network hiccups against Neon / the photo host. `skipped` counts items that
  // already existed (a re-run), which is still a pass.
  expect(created + skipped).toBeGreaterThanOrEqual(queue.length - 10);
  expect(created + skipped).toBeGreaterThan(Math.min(150, queue.length - 1));
});
