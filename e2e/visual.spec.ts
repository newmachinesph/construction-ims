import { test } from "@playwright/test";
import { USERS, login } from "./helpers";

/** Capture screenshots for a quick visual check of the black-and-white design. */
test("capture dashboard screenshots", async ({ page }) => {
  await page.goto("/login");
  await page.screenshot({ path: "screenshots/login.png", fullPage: true });

  await login(page, USERS.admin);
  await page.screenshot({ path: "screenshots/dashboard.png", fullPage: true });

  await page.goto("/stock");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/stock.png", fullPage: true });

  await page.goto("/purchase-orders");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/purchase-orders.png", fullPage: true });
});
