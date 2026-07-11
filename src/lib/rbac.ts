import type { Role } from "@/db/schema";

/**
 * Permission model: flat `resource:action` strings, granted per role.
 *
 * Two independent gates protect every mutation:
 *   1. hasPermission()  — "may this ROLE ever do this?"
 *   2. assertSeparationOfDuties() — "may THIS USER do it on THIS document?"
 *
 * Gate 2 exists because the fraud that actually happens in PH construction
 * firms is one person raising, approving and receiving their own PO. No role
 * grant can express that; it depends on who touched the document earlier.
 */

export const PERMISSIONS = [
  // master data
  "item:read", "item:write",
  "category:read", "category:write",
  "supplier:read", "supplier:write",
  "project:read", "project:write",
  "warehouse:read", "warehouse:write",

  // procurement
  "po:read", "po:create", "po:update", "po:approve", "po:cancel",

  // receiving
  "grn:read", "grn:create", "grn:post",

  // requisition / issuance
  "mr:read", "mr:create", "mr:approve", "mr:cancel",
  "issuance:read", "issuance:create", "issuance:post",

  // stock movement
  "transfer:read", "transfer:create", "transfer:dispatch", "transfer:receive",
  "adjustment:read", "adjustment:create", "adjustment:approve", "adjustment:post",

  // counter sales (POS)
  "sale:read", "sale:create",
  "customer:read", "customer:write",

  // visibility
  "stock:read",
  "movement:read",
  "report:read",
  "report:cost", // unit costs, margins, supplier pricing
  "audit:read",

  // administration
  "user:read", "user:write",
  "settings:read", "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: Permission[] = [
  "item:read", "category:read", "supplier:read", "project:read", "warehouse:read",
  "po:read", "grn:read", "mr:read", "issuance:read", "transfer:read", "adjustment:read",
  "sale:read", "customer:read",
  "stock:read", "movement:read", "report:read",
];

/**
 * Segregation of duties is baked in:
 *  - PROCUREMENT_OFFICER writes POs but cannot approve or receive them.
 *  - WAREHOUSEMAN receives and issues stock but cannot see costs or approve.
 *  - ACCOUNTANT sees every peso but cannot move a single bag of cement.
 *  - AUDITOR reads everything, including the audit log, and writes nothing.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  ADMIN: PERMISSIONS,

  PROJECT_MANAGER: [
    ...READ_ONLY,
    "report:cost",
    "project:write",
    "po:approve",
    "po:cancel",
    "mr:approve",
    "mr:cancel",
    "adjustment:approve",
  ],

  PROCUREMENT_OFFICER: [
    ...READ_ONLY,
    "report:cost",
    "supplier:write",
    "item:write",
    "po:create",
    "po:update",
    "po:cancel",
  ],

  WAREHOUSEMAN: [
    // Deliberately no `report:cost`: the bodegero counts bags, not pesos.
    // Selling price is not cost, so manning the counter is fine.
    ...READ_ONLY,
    "grn:create",
    "grn:post",
    "issuance:create",
    "issuance:post",
    "transfer:create",
    "transfer:dispatch",
    "transfer:receive",
    "adjustment:create",
    "sale:create",
    "customer:write",
  ],

  SITE_ENGINEER: [
    ...READ_ONLY,
    "mr:create",
    "mr:cancel",
    "transfer:receive",
    "adjustment:create",
  ],

  ACCOUNTANT: [
    ...READ_ONLY,
    "report:cost",
    "audit:read",
    "supplier:write",
    "customer:write",
  ],

  AUDITOR: [...READ_ONLY, "report:cost", "audit:read"],

  VIEWER: ["stock:read", "item:read", "project:read", "warehouse:read", "report:read"],
} as const;

const PERMISSION_SETS = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, new Set(perms)]),
) as unknown as Record<Role, ReadonlySet<Permission>>;

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSION_SETS[role]?.has(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/* --------------------- segregation of duties ------------------------ */

export class SeparationOfDutiesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeparationOfDutiesError";
  }
}

/**
 * Reject an action when the same person already played a conflicting part in
 * the document's life. ADMIN is NOT exempt — that is the whole point.
 *
 * @param actorId   who is acting now
 * @param conflictingActorIds  users whose earlier role on this document bars them
 */
export function assertSeparationOfDuties(
  actorId: string,
  conflictingActorIds: readonly (string | null | undefined)[],
  message: string,
): void {
  if (conflictingActorIds.some((id) => id === actorId)) {
    throw new SeparationOfDutiesError(message);
  }
}

/** Approving a PO you raised yourself. */
export function assertCanApprovePo(actorId: string, po: { createdBy: string }): void {
  assertSeparationOfDuties(actorId, [po.createdBy], "You cannot approve a purchase order you created.");
}

/** Receiving goods against a PO you raised or approved. */
export function assertCanReceivePo(
  actorId: string,
  po: { createdBy: string; approvedBy: string | null },
): void {
  assertSeparationOfDuties(
    actorId,
    [po.createdBy, po.approvedBy],
    "You cannot receive goods against a purchase order you created or approved.",
  );
}

/** Approving a material requisition you raised yourself. */
export function assertCanApproveMr(actorId: string, mr: { requestedBy: string }): void {
  assertSeparationOfDuties(
    actorId,
    [mr.requestedBy],
    "You cannot approve a material requisition you requested.",
  );
}

/** Approving a stock adjustment you raised — the pilferage cover-up path. */
export function assertCanApproveAdjustment(actorId: string, adj: { createdBy: string }): void {
  assertSeparationOfDuties(
    actorId,
    [adj.createdBy],
    "You cannot approve a stock adjustment you created.",
  );
}

/* ------------------------------- UI --------------------------------- */

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  PROCUREMENT_OFFICER: "Procurement Officer",
  WAREHOUSEMAN: "Warehouseman (Bodegero)",
  SITE_ENGINEER: "Site Engineer",
  ACCOUNTANT: "Accountant",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

/** Nav entries are filtered by the first permission the user must hold. */
export const NAV_PERMISSIONS = {
  dashboard: "stock:read",
  pos: "sale:create",
  sales: "sale:read",
  customers: "customer:read",
  stock: "stock:read",
  items: "item:read",
  purchaseOrders: "po:read",
  goodsReceipts: "grn:read",
  requisitions: "mr:read",
  issuances: "issuance:read",
  transfers: "transfer:read",
  adjustments: "adjustment:read",
  suppliers: "supplier:read",
  projects: "project:read",
  warehouses: "warehouse:read",
  reports: "report:read",
  audit: "audit:read",
  users: "user:read",
  settings: "settings:read",
} as const satisfies Record<string, Permission>;
