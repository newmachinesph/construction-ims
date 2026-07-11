-- POS tables shipped in 0004 without the CHECK constraints that 0002 gave every
-- other financial table. This closes that gap so a bug above the DB cannot write
-- a negative total, a zero quantity, or a negative price into a BIR sales invoice
-- when the identical mistake on a purchase order would be rejected.
--
-- Mirrors the existing pattern:
--   purchase_order_items: qty_ordered > 0, qty_received >= 0, unit_price >= 0
--   purchase_orders:      subtotal/vat_amount/ewt_amount/total >= 0
--   items:                standard_cost/reorder_point/reorder_qty >= 0

-- Sale lines: a line must move a real quantity at a real price.
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_qty_pos" CHECK ("quantity" > 0);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_unit_price_nonneg" CHECK ("unit_price" >= 0);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_line_total_nonneg" CHECK ("line_total" >= 0);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_unit_cost_nonneg" CHECK ("unit_cost" >= 0);
--> statement-breakpoint

-- Sale header: every money column on the invoice.
ALTER TABLE "sales" ADD CONSTRAINT "sales_subtotal_nonneg" CHECK ("subtotal" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_vatable_nonneg" CHECK ("vatable_sales" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_zero_rated_nonneg" CHECK ("zero_rated_sales" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_exempt_nonneg" CHECK ("exempt_sales" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_vat_amount_nonneg" CHECK ("vat_amount" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_nonneg" CHECK ("total" >= 0);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_amount_tendered_nonneg" CHECK ("amount_tendered" IS NULL OR "amount_tendered" >= 0);
--> statement-breakpoint

-- Cash must cover the bill. The service also requires a tender amount for CASH;
-- this is the on-disk backstop for the half a CHECK can express.
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_tendered_covers_total"
  CHECK ("payment_method" <> 'CASH' OR "amount_tendered" IS NULL OR "amount_tendered" >= "total");
--> statement-breakpoint

-- selling_price was added in 0004 without the guard its three sibling columns have.
ALTER TABLE "items" ADD CONSTRAINT "items_selling_price_nonneg" CHECK ("selling_price" >= 0);
