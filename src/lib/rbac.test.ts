import { describe, expect, it } from "vitest";
import {
  SeparationOfDutiesError,
  assertCanApproveAdjustment,
  assertCanApproveMr,
  assertCanApprovePo,
  assertCanReceivePo,
  hasPermission,
  permissionsFor,
} from "./rbac";

describe("role permissions", () => {
  it("gives ADMIN every permission", () => {
    expect(hasPermission("ADMIN", "user:write")).toBe(true);
    expect(hasPermission("ADMIN", "settings:write")).toBe(true);
    expect(hasPermission("ADMIN", "adjustment:approve")).toBe(true);
  });

  it("lets procurement create but never approve its own POs", () => {
    expect(hasPermission("PROCUREMENT_OFFICER", "po:create")).toBe(true);
    expect(hasPermission("PROCUREMENT_OFFICER", "po:approve")).toBe(false);
  });

  it("lets the project manager approve POs but not create them", () => {
    expect(hasPermission("PROJECT_MANAGER", "po:approve")).toBe(true);
    expect(hasPermission("PROJECT_MANAGER", "po:create")).toBe(false);
  });

  it("hides costs from the warehouseman", () => {
    expect(hasPermission("WAREHOUSEMAN", "grn:post")).toBe(true);
    expect(hasPermission("WAREHOUSEMAN", "issuance:post")).toBe(true);
    expect(hasPermission("WAREHOUSEMAN", "report:cost")).toBe(false);
    expect(hasPermission("WAREHOUSEMAN", "po:approve")).toBe(false);
  });

  it("keeps the accountant out of physical stock movements", () => {
    expect(hasPermission("ACCOUNTANT", "report:cost")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "audit:read")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "grn:post")).toBe(false);
    expect(hasPermission("ACCOUNTANT", "issuance:post")).toBe(false);
  });

  it("makes the auditor read-only (reads + cost visibility, no writes)", () => {
    const perms = permissionsFor("AUDITOR");
    // Auditor may see costs to audit them, but performs no mutations.
    expect(perms.every((p) => p.endsWith(":read") || p === "report:cost")).toBe(true);
    expect(hasPermission("AUDITOR", "audit:read")).toBe(true);
    expect(hasPermission("AUDITOR", "report:cost")).toBe(true);
    expect(hasPermission("AUDITOR", "adjustment:create")).toBe(false);
    expect(hasPermission("AUDITOR", "grn:post")).toBe(false);
  });

  it("limits the viewer to dashboards", () => {
    expect(hasPermission("VIEWER", "stock:read")).toBe(true);
    expect(hasPermission("VIEWER", "item:write")).toBe(false);
    expect(hasPermission("VIEWER", "po:read")).toBe(false);
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
});
