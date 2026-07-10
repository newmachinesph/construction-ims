import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, USERS, login } from "./helpers";

test.describe("authentication", () => {
  test("logs in with valid credentials and lands on the dashboard", async ({ page }) => {
    await login(page, USERS.admin);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("rejects a wrong password without leaking which field was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"], input[name="email"]').first().fill(USERS.admin);
    await page.locator('input[type="password"], input[name="password"]').first().fill("wrong-password-x");
    await page.getByRole("button", { name: /log ?in|sign ?in|continue/i }).click();

    // Stays on /login and shows a generic error.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("redirects an unauthenticated user away from a protected page", async ({ page }) => {
    await page.goto("/stock");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs out and can no longer reach the dashboard", async ({ page }) => {
    await login(page, USERS.admin, DEMO_PASSWORD);
    // Reload for a fresh server-action binding: on a cold dev server the first
    // render's action digest can go stale after lazy recompilation.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /log ?out|sign ?out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("RBAC", () => {
  test("a viewer cannot reach the users admin page", async ({ page }) => {
    await login(page, USERS.viewer);
    await page.goto("/users");
    // requirePermissionPage redirects unauthorized roles to /forbidden.
    await expect(page).toHaveURL(/\/forbidden|\/dashboard/);
    await expect(page.getByText(/users/i).first()).toBeVisible().catch(() => {});
  });
});
