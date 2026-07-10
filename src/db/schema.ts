import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ *
 * Money & quantity conventions
 *   money    -> numeric(14,2)  PHP, always a string in JS (never float)
 *   quantity -> numeric(14,3)  supports cu.m / bd.ft fractions
 * Timestamps are timestamptz (UTC on disk); render in Asia/Manila.
 * ------------------------------------------------------------------ */
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 14, scale: 3 });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------- enums ------------------------------ */

export const roleEnum = pgEnum("role", [
  "ADMIN", // owner / system administrator
  "PROJECT_MANAGER",
  "PROCUREMENT_OFFICER",
  "WAREHOUSEMAN", // bodegero
  "SITE_ENGINEER",
  "ACCOUNTANT",
  "AUDITOR", // read-only, incl. audit log
  "VIEWER",
]);

/** BIR VAT classification of a line item. */
export const vatClassEnum = pgEnum("vat_class", ["VATABLE", "ZERO_RATED", "EXEMPT"]);

/** Supplier VAT registration status — drives whether input VAT is claimable. */
export const supplierVatStatusEnum = pgEnum("supplier_vat_status", [
  "VAT_REGISTERED",
  "NON_VAT",
  "EXEMPT",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

export const warehouseKindEnum = pgEnum("warehouse_kind", ["MAIN_WAREHOUSE", "SITE_BODEGA"]);

export const uomEnum = pgEnum("uom", [
  "BAG", // cement, 40kg
  "PC", // pieces (CHB, fittings)
  "LENGTH", // rebar / pipe, standard 6.0 m commercial length
  "KG",
  "TON",
  "CU_M", // cubic metre — sand, gravel, ready-mix concrete
  "SQ_M",
  "M",
  "LM", // linear metre
  "BD_FT", // board foot — lumber
  "SHEET", // 4' x 8' plywood / phenolic / G.I.
  "ROLL",
  "L",
  "GAL",
  "PAIL",
  "SET",
  "LOT",
]);

export const poStatusEnum = pgEnum("po_status", [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const mrStatusEnum = pgEnum("mr_status", [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PARTIALLY_ISSUED",
  "ISSUED",
  "CANCELLED",
]);

export const docStatusEnum = pgEnum("doc_status", ["DRAFT", "POSTED", "CANCELLED"]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "DRAFT",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "RECEIPT", // + from supplier (GRN)
  "ISSUE", // - to project/site (Material Issuance Slip)
  "TRANSFER_OUT", // - source warehouse
  "TRANSFER_IN", // + destination warehouse
  "ADJUSTMENT", // +/- physical count, damage, pilferage
  "RETURN_TO_SUPPLIER", // -
  "RETURN_FROM_SITE", // +
]);

export const adjustmentReasonEnum = pgEnum("adjustment_reason", [
  "COUNT_VARIANCE",
  "DAMAGE",
  "PILFERAGE",
  "SPOILAGE", // cement hardened by rain/humidity
  "CORRECTION",
]);

/** Documents that require a gapless BIR-style serial series. */
export const docSeriesEnum = pgEnum("doc_series", [
  "PO",
  "GRN",
  "MR",
  "ISSUANCE",
  "TRANSFER",
  "ADJUSTMENT",
]);

/* ------------------------------- auth ------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    role: roleEnum("role").notNull().default("VIEWER"),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

/**
 * Opaque server-side sessions. The cookie holds a random token; we store only
 * its SHA-256 hash, so a DB dump cannot be replayed as a login.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/* ---------------------------- master data --------------------------- */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  clientName: varchar("client_name", { length: 200 }),
  location: varchar("location", { length: 240 }),
  status: projectStatusEnum("status").notNull().default("PLANNING"),
  startDate: date("start_date"),
  targetEndDate: date("target_end_date"),
  contractAmount: money("contract_amount"),
  ...timestamps,
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  kind: warehouseKindEnum("kind").notNull().default("MAIN_WAREHOUSE"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "restrict" }),
  address: varchar("address", { length: 240 }),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  /** BIR TIN. 9 digits + optional 3-5 digit branch code: 000-000-000-00000. */
  tin: varchar("tin", { length: 20 }),
  vatStatus: supplierVatStatusEnum("vat_status").notNull().default("VAT_REGISTERED"),
  /** False = supplier is EWT-exempt (e.g. another TWA, or a BIR-exempt entity). */
  ewtApplicable: boolean("ewt_applicable").notNull().default(true),
  /**
   * Creditable withholding rate applied when WE are a Top Withholding Agent.
   * 0.0100 = 1% purchase of goods    (ATC WC158)
   * 0.0200 = 2% services/contractors (ATC WC120 / WC160)
   */
  ewtRate: numeric("ewt_rate", { precision: 6, scale: 4 }).notNull().default("0.0100"),
  atcCode: varchar("atc_code", { length: 10 }).notNull().default("WC158"),
  contactPerson: varchar("contact_person", { length: 160 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }),
  address: varchar("address", { length: 240 }),
  leadTimeDays: integer("lead_time_days").notNull().default(7),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: varchar("sku", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    uom: uomEnum("uom").notNull(),
    /**
     * Mass of one stocking UoM, when the trade also prices by weight.
     * 12mm x 6m deformed bar = 5.328 kg -> lets us reconcile a supplier
     * invoice priced per kg against stock counted in LENGTH.
     */
    weightKgPerUom: numeric("weight_kg_per_uom", { precision: 12, scale: 4 }),
    /** DPWH standard pay-item code, for government-funded projects. */
    dpwhPayItem: varchar("dpwh_pay_item", { length: 24 }),
    vatClass: vatClassEnum("vat_class").notNull().default("VATABLE"),
    standardCost: money("standard_cost").notNull().default("0"),
    reorderPoint: qty("reorder_point").notNull().default("0"),
    reorderQty: qty("reorder_qty").notNull().default("0"),
    /** Extra buffer held during typhoon / habagat season. */
    isWeatherSensitive: boolean("is_weather_sensitive").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("items_category_idx").on(t.categoryId), index("items_name_idx").on(t.name)],
);

/* -------------------------- company settings ------------------------ */

/**
 * Single-row table (id is always 1). Drives tax behaviour for the whole app:
 * EWT is only withheld when `isTopWithholdingAgent` is true.
 */
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  name: varchar("name", { length: 200 }).notNull(),
  tin: varchar("tin", { length: 20 }),
  address: varchar("address", { length: 240 }),
  /** Philippine Contractors Accreditation Board licence number. */
  pcabLicenseNo: varchar("pcab_license_no", { length: 40 }),
  vatRegistered: boolean("vat_registered").notNull().default(true),
  /** BIR-designated Top Withholding Agent -> must withhold EWT on purchases. */
  isTopWithholdingAgent: boolean("is_top_withholding_agent").notNull().default(false),
  ...timestamps,
});

/* ------------------------- document numbering ----------------------- */

/**
 * BIR requires gapless, sequential serial numbers per document type.
 * `nextNumber` is bumped with `UPDATE ... RETURNING` inside the same
 * transaction as the document insert, so concurrent writers serialise.
 */
export const documentSeries = pgTable("document_series", {
  series: docSeriesEnum("series").primaryKey(),
  prefix: varchar("prefix", { length: 12 }).notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  padding: integer("padding").notNull().default(6),
});

/* ------------------------------- stock ------------------------------ */

export const stockLevels = pgTable(
  "stock_levels",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    qtyOnHand: qty("qty_on_hand").notNull().default("0"),
    /** Approved-but-not-yet-issued MR quantities. */
    qtyReserved: qty("qty_reserved").notNull().default("0"),
    /** Moving-average cost, PHP per UoM. */
    avgUnitCost: money("avg_unit_cost").notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.warehouseId] }),
    index("stock_levels_warehouse_idx").on(t.warehouseId),
  ],
);

/** Append-only ledger. Never UPDATE or DELETE — reversals are new rows. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    type: movementTypeEnum("type").notNull(),
    /** Signed: positive = into warehouse, negative = out. */
    quantity: qty("quantity").notNull(),
    unitCost: money("unit_cost").notNull().default("0"),
    /** Running balance after this movement, for audit reconstruction. */
    balanceAfter: qty("balance_after").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    refType: varchar("ref_type", { length: 24 }),
    refId: uuid("ref_id"),
    refNumber: varchar("ref_number", { length: 40 }),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movements_item_wh_idx").on(t.itemId, t.warehouseId),
    index("movements_created_idx").on(t.createdAt),
    index("movements_ref_idx").on(t.refType, t.refId),
  ],
);

/* --------------------------- purchase orders ------------------------ */

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poNumber: varchar("po_number", { length: 40 }).notNull().unique(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    status: poStatusEnum("status").notNull().default("DRAFT"),
    orderDate: date("order_date").notNull(),
    expectedDate: date("expected_date"),
    /** Net of VAT. */
    subtotal: money("subtotal").notNull().default("0"),
    vatAmount: money("vat_amount").notNull().default("0"),
    /** Expanded withholding tax, deducted from what we pay the supplier. */
    ewtAmount: money("ewt_amount").notNull().default("0"),
    /** subtotal + vat (gross invoice value, before EWT deduction). */
    total: money("total").notNull().default("0"),
    /** total - ewt = cash actually remitted to supplier. */
    netPayable: money("net_payable").notNull().default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    ...timestamps,
  },
  (t) => [index("po_status_idx").on(t.status), index("po_supplier_idx").on(t.supplierId)],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    qtyOrdered: qty("qty_ordered").notNull(),
    qtyReceived: qty("qty_received").notNull().default("0"),
    /** VAT-exclusive unit price. */
    unitPrice: money("unit_price").notNull(),
    vatClass: vatClassEnum("vat_class").notNull().default("VATABLE"),
    lineTotal: money("line_total").notNull(),
  },
  (t) => [index("po_items_po_idx").on(t.poId)],
);

/* ------------------- goods receipt (GRN / vs supplier DR) ----------- */

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  grnNumber: varchar("grn_number", { length: 40 }).notNull().unique(),
  poId: uuid("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "restrict" }),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "restrict" }),
  /**
   * Post-EOPT (RR 7-2024): the SALES INVOICE is the sole primary document and
   * the only valid basis for claiming input VAT. The supplier's Delivery
   * Receipt is supplementary — captured for the 3-way match, not for tax.
   */
  supplierDrNumber: varchar("supplier_dr_number", { length: 60 }),
  supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 60 }),
  supplierInvoiceDate: date("supplier_invoice_date"),
  receivedDate: date("received_date").notNull(),
  status: docStatusEnum("status").notNull().default("DRAFT"),
  remarks: text("remarks"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  ...timestamps,
});

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grnId: uuid("grn_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade" }),
    poItemId: uuid("po_item_id")
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    qtyReceived: qty("qty_received").notNull(),
    /** Short-delivered / wet cement / bent rebar — never enters stock. */
    qtyRejected: qty("qty_rejected").notNull().default("0"),
    unitCost: money("unit_cost").notNull(),
    remarks: text("remarks"),
  },
  (t) => [index("grn_items_grn_idx").on(t.grnId)],
);

/* --------------------- material requisition (MR) -------------------- */

export const materialRequisitions = pgTable(
  "material_requisitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mrNumber: varchar("mr_number", { length: 40 }).notNull().unique(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    /** Warehouse the goods are pulled from. */
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: mrStatusEnum("status").notNull().default("DRAFT"),
    neededDate: date("needed_date").notNull(),
    purpose: text("purpose"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    ...timestamps,
  },
  (t) => [index("mr_status_idx").on(t.status), index("mr_project_idx").on(t.projectId)],
);

export const materialRequisitionItems = pgTable(
  "material_requisition_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mrId: uuid("mr_id")
      .notNull()
      .references(() => materialRequisitions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    qtyRequested: qty("qty_requested").notNull(),
    qtyIssued: qty("qty_issued").notNull().default("0"),
  },
  (t) => [index("mr_items_mr_idx").on(t.mrId)],
);

/* ---------------- issuance (Material Issuance Slip) ----------------- */

export const issuances = pgTable("issuances", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueNumber: varchar("issue_number", { length: 40 }).notNull().unique(),
  mrId: uuid("mr_id")
    .notNull()
    .references(() => materialRequisitions.id, { onDelete: "restrict" }),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "restrict" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  status: docStatusEnum("status").notNull().default("DRAFT"),
  /** Foreman / gang leader who physically received the materials. */
  receivedByName: varchar("received_by_name", { length: 160 }).notNull(),
  issuedBy: uuid("issued_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  ...timestamps,
});

export const issuanceItems = pgTable(
  "issuance_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issuanceId: uuid("issuance_id")
      .notNull()
      .references(() => issuances.id, { onDelete: "cascade" }),
    mrItemId: uuid("mr_item_id")
      .notNull()
      .references(() => materialRequisitionItems.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull(),
  },
  (t) => [index("issuance_items_issuance_idx").on(t.issuanceId)],
);

/* ----------------------------- transfers ---------------------------- */

export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  transferNumber: varchar("transfer_number", { length: 40 }).notNull().unique(),
  fromWarehouseId: uuid("from_warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "restrict" }),
  toWarehouseId: uuid("to_warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "restrict" }),
  status: transferStatusEnum("status").notNull().default("DRAFT"),
  /** Set when goods leave the source (TRANSFER_OUT posted). */
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  /** Set when goods land at destination (TRANSFER_IN posted). */
  receivedAt: timestamp("received_at", { withTimezone: true }),
  remarks: text("remarks"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const transferItems = pgTable(
  "transfer_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transfers.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull(),
  },
  (t) => [index("transfer_items_transfer_idx").on(t.transferId)],
);

/* ---------------------------- adjustments --------------------------- */

export const stockAdjustments = pgTable("stock_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  adjustmentNumber: varchar("adjustment_number", { length: 40 }).notNull().unique(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "restrict" }),
  reason: adjustmentReasonEnum("reason").notNull(),
  status: docStatusEnum("status").notNull().default("DRAFT"),
  remarks: text("remarks"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  /** Adjustments always need a second pair of eyes — pilferage control. */
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  ...timestamps,
});

export const stockAdjustmentItems = pgTable(
  "stock_adjustment_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adjustmentId: uuid("adjustment_id")
      .notNull()
      .references(() => stockAdjustments.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    /** Signed delta applied to qty_on_hand. */
    qtyDelta: qty("qty_delta").notNull(),
    remarks: text("remarks"),
  },
  (t) => [index("adj_items_adj_idx").on(t.adjustmentId)],
);

/* ---------------------------- attachments --------------------------- */

/**
 * Photos/files attached to a domain record (material reference images,
 * delivery-proof photos on a GRN). The bytes live in Cloudflare R2 under
 * `objectKey`; this row is the metadata + access record. Polymorphic by
 * (entity, entityId) so one table serves every attachable record.
 */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    originalName: varchar("original_name", { length: 255 }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_entity_idx").on(t.entity, t.entityId)],
);

/* ------------------------------ audit ------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: varchar("actor_email", { length: 255 }),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_actor_idx").on(t.actorId),
  ],
);

/* ---------------------------- relations ----------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, { fields: [items.categoryId], references: [categories.id] }),
  stockLevels: many(stockLevels),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  project: one(projects, { fields: [warehouses.projectId], references: [projects.id] }),
  stockLevels: many(stockLevels),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  item: one(items, { fields: [stockLevels.itemId], references: [items.id] }),
  warehouse: one(warehouses, { fields: [stockLevels.warehouseId], references: [warehouses.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  warehouse: one(warehouses, { fields: [purchaseOrders.warehouseId], references: [warehouses.id] }),
  project: one(projects, { fields: [purchaseOrders.projectId], references: [projects.id] }),
  lines: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  po: one(purchaseOrders, { fields: [purchaseOrderItems.poId], references: [purchaseOrders.id] }),
  item: one(items, { fields: [purchaseOrderItems.itemId], references: [items.id] }),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  po: one(purchaseOrders, { fields: [goodsReceipts.poId], references: [purchaseOrders.id] }),
  warehouse: one(warehouses, { fields: [goodsReceipts.warehouseId], references: [warehouses.id] }),
  lines: many(goodsReceiptItems),
}));

export const goodsReceiptItemsRelations = relations(goodsReceiptItems, ({ one }) => ({
  grn: one(goodsReceipts, { fields: [goodsReceiptItems.grnId], references: [goodsReceipts.id] }),
  item: one(items, { fields: [goodsReceiptItems.itemId], references: [items.id] }),
  poItem: one(purchaseOrderItems, {
    fields: [goodsReceiptItems.poItemId],
    references: [purchaseOrderItems.id],
  }),
}));

export const materialRequisitionsRelations = relations(materialRequisitions, ({ one, many }) => ({
  project: one(projects, { fields: [materialRequisitions.projectId], references: [projects.id] }),
  warehouse: one(warehouses, {
    fields: [materialRequisitions.warehouseId],
    references: [warehouses.id],
  }),
  requester: one(users, { fields: [materialRequisitions.requestedBy], references: [users.id] }),
  lines: many(materialRequisitionItems),
}));

export const materialRequisitionItemsRelations = relations(materialRequisitionItems, ({ one }) => ({
  mr: one(materialRequisitions, {
    fields: [materialRequisitionItems.mrId],
    references: [materialRequisitions.id],
  }),
  item: one(items, { fields: [materialRequisitionItems.itemId], references: [items.id] }),
}));

export const issuancesRelations = relations(issuances, ({ one, many }) => ({
  mr: one(materialRequisitions, {
    fields: [issuances.mrId],
    references: [materialRequisitions.id],
  }),
  warehouse: one(warehouses, { fields: [issuances.warehouseId], references: [warehouses.id] }),
  project: one(projects, { fields: [issuances.projectId], references: [projects.id] }),
  lines: many(issuanceItems),
}));

export const issuanceItemsRelations = relations(issuanceItems, ({ one }) => ({
  issuance: one(issuances, { fields: [issuanceItems.issuanceId], references: [issuances.id] }),
  item: one(items, { fields: [issuanceItems.itemId], references: [items.id] }),
}));

export const transfersRelations = relations(transfers, ({ one, many }) => ({
  fromWarehouse: one(warehouses, {
    fields: [transfers.fromWarehouseId],
    references: [warehouses.id],
    relationName: "from",
  }),
  toWarehouse: one(warehouses, {
    fields: [transfers.toWarehouseId],
    references: [warehouses.id],
    relationName: "to",
  }),
  lines: many(transferItems),
}));

export const transferItemsRelations = relations(transferItems, ({ one }) => ({
  transfer: one(transfers, { fields: [transferItems.transferId], references: [transfers.id] }),
  item: one(items, { fields: [transferItems.itemId], references: [items.id] }),
}));

export const stockAdjustmentsRelations = relations(stockAdjustments, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [stockAdjustments.warehouseId],
    references: [warehouses.id],
  }),
  lines: many(stockAdjustmentItems),
}));

export const stockAdjustmentItemsRelations = relations(stockAdjustmentItems, ({ one }) => ({
  adjustment: one(stockAdjustments, {
    fields: [stockAdjustmentItems.adjustmentId],
    references: [stockAdjustments.id],
  }),
  item: one(items, { fields: [stockAdjustmentItems.itemId], references: [items.id] }),
}));

/* ------------------------------ types ------------------------------- */

export type Role = (typeof roleEnum.enumValues)[number];
export type Uom = (typeof uomEnum.enumValues)[number];
export type VatClass = (typeof vatClassEnum.enumValues)[number];
export type MovementType = (typeof movementTypeEnum.enumValues)[number];
export type DocSeries = (typeof docSeriesEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
