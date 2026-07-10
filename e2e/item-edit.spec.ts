import { expect, test } from "@playwright/test";
import { USERS, login } from "./helpers";

/**
 * Verifies the two gaps the user hit: after creating an item you land on its
 * detail page (where photos can be uploaded), and the item can be edited.
 */
test("create item redirects to detail, which offers edit + photo upload", async ({ page }) => {
  await login(page, USERS.admin);

  const sku = `TEST-${Date.now().toString().slice(-8)}`;

  await page.goto("/items");
  await page.getByRole("button", { name: /new item/i }).first().click();
  await page.fill("#sku", sku);
  await page.fill("#name", "QA Test Cement");
  await page.selectOption("#categoryId", { label: "Cement & Concrete" });
  await page.selectOption("#uom", "BAG");
  await page.fill("#standardCost", "305");
  await page.fill("#reorderPoint", "100");
  await page.fill("#reorderQty", "300");
  await page.getByRole("button", { name: /save item/i }).click();

  // Lands on the new item's detail page.
  await page.waitForURL(/\/items\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await expect(page.getByText(sku)).toBeVisible();

  // Photo upload surface is present (the hidden file input from PhotoManager).
  await expect(page.locator('input[type="file"]')).toHaveCount(1);

  // Edit the item.
  await page.getByRole("button", { name: /edit item/i }).click();
  await page.fill("#e-name", "QA Test Cement (edited)");
  await page.fill("#e-standardCost", "319");
  await page.getByRole("button", { name: /save changes/i }).click();

  // The updated name shows after refresh.
  await expect(page.getByText("QA Test Cement (edited)").first()).toBeVisible({ timeout: 10_000 });
});
