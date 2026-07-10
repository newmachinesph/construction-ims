import { expect, type BrowserContext, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Password123!";

export const USERS = {
  admin: "admin@ims.ph",
  pm: "pm@ims.ph",
  procurement: "procurement@ims.ph",
  bodega: "bodega@ims.ph",
  engineer: "engineer@ims.ph",
  accountant: "accountant@ims.ph",
  auditor: "auditor@ims.ph",
  viewer: "viewer@ims.ph",
} as const;

/**
 * Log in through the real login form. Selectors are kept resilient
 * (input types + button role) so they survive UI markup changes.
 */
export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.getByRole("button", { name: /log ?in|sign ?in|continue/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/** A fresh authenticated context for a given demo user. */
export async function contextFor(
  browser: import("@playwright/test").Browser,
  email: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
}

/** Assert an API JSON envelope succeeded and return its `data`. */
export async function expectOk(res: import("@playwright/test").APIResponse) {
  const body = await res.json();
  expect(body.ok, `API error: ${JSON.stringify(body)}`).toBe(true);
  return body.data;
}
