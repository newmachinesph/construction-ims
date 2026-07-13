import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  SeparationOfDutiesError,
  assertCanApproveAdjustment,
  assertCanApproveMr,
  assertCanApprovePo,
  assertCanReceivePo,
  hasPermission,
  isPermission,
  permissionsFor,
  sanitizePermissions,
  type Permission,
  type SystemRoleKey,
} from "./rbac";

/** Does a built-in role's seeded permission set grant this? */
const roleCan = (role: SystemRoleKey, permission: Permission) =>
  hasPermission(permissionsFor(role), permission);

describe("role permissions", () => {
  it("gives ADMIN every permission", () => {
    expect(roleCan("ADMIN", "user:write")).toBe(true);
    expect(roleCan("ADMIN", "settings:write")).toBe(true);
    expect(roleCan("ADMIN", "adjustment:approve")).toBe(true);
    expect(roleCan("ADMIN", "role:write")).toBe(true);
    // ADMIN's seed is literally the whole catalogue.
    expect(permissionsFor("ADMIN")).toHaveLength(PERMISSIONS.length);
  });

  it("lets procurement create but never approve its own POs", () => {
    expect(roleCan("PROCUREMENT_OFFICER", "po:create")).toBe(true);
    expect(roleCan("PROCUREMENT_OFFICER", "po:approve")).toBe(false);
  });

  it("lets the project manager approve POs but not create them", () => {
    expect(roleCan("PROJECT_MANAGER", "po:approve")).toBe(true);
    expect(roleCan("PROJECT_MANAGER", "po:create")).toBe(false);
  });

  it("hides costs from the warehouseman", () => {
    expect(roleCan("WAREHOUSEMAN", "grn:post")).toBe(true);
    expect(roleCan("WAREHOUSEMAN", "issuance:post")).toBe(true);
    expect(roleCan("WAREHOUSEMAN", "report:cost")).toBe(false);
    expect(roleCan("WAREHOUSEMAN", "po:approve")).toBe(false);
  });

  it("keeps the accountant out of physical stock movements", () => {
    expect(roleCan("ACCOUNTANT", "report:cost")).toBe(true);
    expect(roleCan("ACCOUNTANT", "audit:read")).toBe(true);
    expect(roleCan("ACCOUNTANT", "grn:post")).toBe(false);
    expect(roleCan("ACCOUNTANT", "issuance:post")).toBe(false);
  });

  it("makes the auditor read-only (reads + cost visibility, no writes)", () => {
    const perms = permissionsFor("AUDITOR");
    // Auditor may see costs to audit them, but performs no mutations.
    expect(perms.every((p) => p.endsWith(":read") || p === "report:cost")).toBe(true);
    expect(roleCan("AUDITOR", "audit:read")).toBe(true);
    expect(roleCan("AUDITOR", "report:cost")).toBe(true);
    expect(roleCan("AUDITOR", "adjustment:create")).toBe(false);
    expect(roleCan("AUDITOR", "grn:post")).toBe(false);
  });

  it("limits the viewer to dashboards", () => {
    expect(roleCan("VIEWER", "stock:read")).toBe(true);
    expect(roleCan("VIEWER", "item:write")).toBe(false);
    expect(roleCan("VIEWER", "po:read")).toBe(false);
  });
});

describe("permission catalogue", () => {
  it("hasPermission works on arrays and sets", () => {
    expect(hasPermission(["po:read", "po:create"], "po:create")).toBe(true);
    expect(hasPermission(new Set<string>(["po:read"]), "po:create")).toBe(false);
    expect(hasPermission(undefined, "po:read")).toBe(false);
  });

  it("only accepts real permission keys", () => {
    expect(isPermission("adjustment:approve")).toBe(true);
    expect(isPermission("adjustment:teleport")).toBe(false);
    // Made-up keys are silently dropped so a role can never hold a fake grant.
    expect(sanitizePermissions(["po:read", "nope", "po:read"])).toEqual(["po:read"]);
  });

  it("lists every permission exactly once across the UI groups", () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    expect(new Set(grouped).size).toBe(grouped.length); // no duplicates
    expect(new Set(grouped)).toEqual(new Set(PERMISSIONS)); // complete coverage
  });
});

describe("separation of duties", () => {
  const alice = "user-alice";
  const bob = "user-bob";

  it("blocks approving a PO you created", () => {
    expect(() => assertCanApprovePo(alice, { createdBy: alice })).toThrow(SeparationOfDutiesError);
    expect(() => assertCanApprovePo(bob, { createdBy: alice })).not.toThrow();
  });

  it("blocks receiving a PO you created or approved", () => {
    expect(() => assertCanReceivePo(alice, { createdBy: alice, approvedBy: bob })).toThrow();
    expect(() => assertCanReceivePo(bob, { createdBy: alice, approvedBy: bob })).toThrow();
    expect(() =>
      assertCanReceivePo("user-carol", { createdBy: alice, approvedBy: bob }),
    ).not.toThrow();
  });

  it("blocks approving an MR you requested", () => {
    expect(() => assertCanApproveMr(alice, { requestedBy: alice })).toThrow();
    expect(() => assertCanApproveMr(bob, { requestedBy: alice })).not.toThrow();
  });

  it("blocks approving an adjustment you created (pilferage cover-up)", () => {
    expect(() => assertCanApproveAdjustment(alice, { createdBy: alice })).toThrow();
    expect(() => assertCanApproveAdjustment(bob, { createdBy: alice })).not.toThrow();
  });

  it("lets the creator self-approve only when explicitly allowed", () => {
    expect(() =>
      assertCanApproveAdjustment(alice, { createdBy: alice }, { allowSelfApprove: true }),
    ).not.toThrow();
    // The flag is opt-in; false or absent keeps the rule.
    expect(() =>
      assertCanApproveAdjustment(alice, { createdBy: alice }, { allowSelfApprove: false }),
    ).toThrow();
  });
});
