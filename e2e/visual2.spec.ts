import { test } from "@playwright/test";
import { USERS, login } from "./helpers";

test("capture new UI: user menu + items pagination", async ({ page }) => {
  await login(page, USERS.admin);

  // User menu dropdown open.
  await page.getByRole("button", { name: /administrator|system/i }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "screenshots/user-menu.png", fullPage: false });

  // Items page (client React Query table + pagination).
  await page.goto("/items");
  await page.getByRole("link", { name: /^[A-Z]{2,4}-/ }).first().waitFor({ timeout: 15_000 });
  await page.screenshot({ path: "screenshots/items-paginated.png", fullPage: true });
});
