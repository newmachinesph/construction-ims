/**
 * Permission model: flat `resource:action` strings.
 *
 * Permissions are a FIXED catalogue — every key below guards a real endpoint in
 * the code, so it is code-bound and cannot be invented at runtime. Roles, by
 * contrast, are DATA (rows in the `roles` table): an administrator composes a
 * role by selecting any subset of this catalogue. The eight built-in roles are
 * seeded from `ROLE_PERMISSIONS` here, but once seeded the database is the source
 * of truth and they can be retuned (except ADMIN, which is locked to full access).
 *
 * Two independent gates protect every mutation:
 *   1. hasPermission()  — "does this user's role grant this?"
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
  "sale:read", "sale:create", "sale:void",
  "customer:read", "customer:write",

  // visibility
  "stock:read",
  "movement:read",
  "report:read",
  "report:cost", // unit costs, margins, supplier pricing
  "audit:read",

  // administration
  "user:read", "user:write",
  "role:read", "role:write",
  "settings:read", "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

/** Narrow an arbitrary string to a known permission (rejects made-up keys). */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Keep only the strings that are real permissions, de-duplicated. */
export function sanitizePermissions(values: readonly string[]): Permission[] {
  const seen = new Set<Permission>();
  for (const v of values) if (isPermission(v)) seen.add(v);
  return [...seen];
}

/* -------------------------- built-in roles -------------------------- */

/** The keys of the eight roles shipped with the system. Custom roles use other keys. */
export const SYSTEM_ROLE_KEYS = [
  "ADMIN",
  "PROJECT_MANAGER",
  "PROCUREMENT_OFFICER",
  "WAREHOUSEMAN",
  "SITE_ENGINEER",
  "ACCOUNTANT",
  "AUDITOR",
  "VIEWER",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

/** ADMIN is special: it is always granted every permission and can never be
 *  edited or deleted, so an administrator cannot strip their own access away. */
export const LOCKED_ROLE_KEY: SystemRoleKey = "ADMIN";

const READ_ONLY: Permission[] = [
  "item:read", "category:read", "supplier:read", "project:read", "warehouse:read",
  "po:read", "grn:read", "mr:read", "issuance:read", "transfer:read", "adjustment:read",
  "sale:read", "customer:read",
  "stock:read", "movement:read", "report:read",
];

/**
 * Seed defaults for the built-in roles. Segregation of duties is baked in:
 *  - PROCUREMENT_OFFICER writes POs but cannot approve or receive them.
 *  - WAREHOUSEMAN receives and issues stock but cannot see costs or approve.
 *  - ACCOUNTANT sees every peso but cannot move a single bag of cement.
 *  - AUDITOR reads everything, including the audit log, and writes nothing.
 *
 * After the first seed these live in the `roles` table; editing a built-in there
 * changes it for real. This map is only the starting point (and the ADMIN source
 * of truth, since ADMIN is always resolved to the full catalogue).
 */
export const ROLE_PERMISSIONS: Readonly<Record<SystemRoleKey, readonly Permission[]>> = {
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
    // Voiding is a books correction, so it sits with finance — deliberately NOT
    // with WAREHOUSEMAN, who rings the sale: a cashier who could void their own
    // sale could ring goods out, pocket the cash, and erase the invoice.
    "sale:void",
  ],

  AUDITOR: [...READ_ONLY, "report:cost", "audit:read"],

  VIEWER: ["stock:read", "item:read", "project:read", "warehouse:read", "report:read"],
} as const;

export const ROLE_LABELS: Readonly<Record<SystemRoleKey, string>> = {
  ADMIN: "Administrator",
  PROJECT_MANAGER: "Project Manager",
  PROCUREMENT_OFFICER: "Procurement Officer",
  WAREHOUSEMAN: "Warehouseman (Bodegero)",
  SITE_ENGINEER: "Site Engineer",
  ACCOUNTANT: "Accountant",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

/** Permissions for a built-in role, as seeded. Used by the seed + migration. */
export function permissionsFor(role: SystemRoleKey): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/* ---------------------------- permission checks --------------------- */

/** Does a resolved permission set include this permission? */
export function hasPermission(
  permissions: readonly string[] | ReadonlySet<string> | undefined,
  permission: Permission,
): boolean {
  if (!permissions) return false;
  return permissions instanceof Set
    ? permissions.has(permission)
    : (permissions as readonly string[]).includes(permission);
}

export function hasAnyPermission(
  permissions: readonly string[] | ReadonlySet<string> | undefined,
  wanted: readonly Permission[],
): boolean {
  return wanted.some((p) => hasPermission(permissions, p));
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

/**
 * Approving a stock adjustment you raised — the pilferage cover-up path.
 *
 * By default the creator can never approve their own adjustment, ADMIN included.
 * A single-admin deployment can opt out of THIS one check via `allowSelfApprove`
 * (backed by a company setting). The caller only ever sets it for an ADMIN actor,
 * so every other role stays bound by the creator≠approver rule regardless.
 */
export function assertCanApproveAdjustment(
  actorId: string,
  adj: { createdBy: string },
  options: { allowSelfApprove?: boolean } = {},
): void {
  if (options.allowSelfApprove) return;
  assertSeparationOfDuties(
    actorId,
    [adj.createdBy],
    "You cannot approve a stock adjustment you created.",
  );
}

/* ------------------------------- UI --------------------------------- */

/** Human-readable, grouped catalogue for the role editor. Every permission in
 *  PERMISSIONS appears exactly once. */
export interface PermissionGroup {
  label: string;
  permissions: readonly { key: Permission; label: string }[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    label: "Master data",
    permissions: [
      { key: "item:read", label: "View items" },
      { key: "item:write", label: "Create / edit items" },
      { key: "category:read", label: "View categories" },
      { key: "category:write", label: "Manage categories" },
      { key: "supplier:read", label: "View suppliers" },
      { key: "supplier:write", label: "Manage suppliers" },
      { key: "project:read", label: "View projects" },
      { key: "project:write", label: "Manage projects" },
      { key: "warehouse:read", label: "View warehouses" },
      { key: "warehouse:write", label: "Manage warehouses" },
    ],
  },
  {
    label: "Procurement",
    permissions: [
      { key: "po:read", label: "View purchase orders" },
      { key: "po:create", label: "Raise purchase orders" },
      { key: "po:update", label: "Edit purchase orders" },
      { key: "po:approve", label: "Approve purchase orders" },
      { key: "po:cancel", label: "Cancel purchase orders" },
      { key: "grn:read", label: "View goods receipts" },
      { key: "grn:create", label: "Create goods receipts" },
      { key: "grn:post", label: "Post goods receipts" },
    ],
  },
  {
    label: "Requisition & issuance",
    permissions: [
      { key: "mr:read", label: "View requisitions" },
      { key: "mr:create", label: "Raise requisitions" },
      { key: "mr:approve", label: "Approve requisitions" },
      { key: "mr:cancel", label: "Cancel requisitions" },
      { key: "issuance:read", label: "View issuances" },
      { key: "issuance:create", label: "Create issuances" },
      { key: "issuance:post", label: "Post issuances" },
    ],
  },
  {
    label: "Stock movement",
    permissions: [
      { key: "transfer:read", label: "View transfers" },
      { key: "transfer:create", label: "Create transfers" },
      { key: "transfer:dispatch", label: "Dispatch transfers" },
      { key: "transfer:receive", label: "Receive transfers" },
      { key: "adjustment:read", label: "View adjustments" },
      { key: "adjustment:create", label: "Raise adjustments (incl. CSV import)" },
      { key: "adjustment:approve", label: "Approve adjustments" },
      { key: "adjustment:post", label: "Post adjustments" },
    ],
  },
  {
    label: "Counter sales (POS)",
    permissions: [
      { key: "sale:read", label: "View sales" },
      { key: "sale:create", label: "Ring sales at the POS" },
      { key: "sale:void", label: "Void sales" },
      { key: "customer:read", label: "View customers" },
      { key: "customer:write", label: "Manage customers" },
    ],
  },
  {
    label: "Visibility & reports",
    permissions: [
      { key: "stock:read", label: "View stock on hand" },
      { key: "movement:read", label: "View stock movements" },
      { key: "report:read", label: "View reports" },
      { key: "report:cost", label: "See costs, margins & supplier pricing" },
      { key: "audit:read", label: "View the audit log" },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { key: "user:read", label: "View users" },
      { key: "user:write", label: "Create / edit users" },
      { key: "role:read", label: "View roles" },
      { key: "role:write", label: "Create / edit roles" },
      { key: "settings:read", label: "View settings" },
      { key: "settings:write", label: "Edit settings" },
    ],
  },
];

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
  roles: "role:read",
  settings: "settings:read",
} as const satisfies Record<string, Permission>;
