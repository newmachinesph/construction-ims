-- Custom SQL migration file, put your code below! --

-- Data-integrity CHECK constraints. The application already enforces these in
-- the ledger service, but a bug or a direct SQL write must not be able to leave
-- negative stock or negative money on disk. Belt and braces for the invariants.

-- Stock can never go negative; reservations and average cost are non-negative.
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_qty_on_hand_nonneg" CHECK ("qty_on_hand" >= 0);
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_qty_reserved_nonneg" CHECK ("qty_reserved" >= 0);
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_avg_cost_nonneg" CHECK ("avg_unit_cost" >= 0);

-- A movement's running balance is never negative; the quantity is signed but
-- must be non-zero (a zero movement is meaningless).
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_balance_nonneg" CHECK ("balance_after" >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_qty_nonzero" CHECK ("quantity" <> 0);

-- Item money/quantity fields are non-negative.
ALTER TABLE "items" ADD CONSTRAINT "items_standard_cost_nonneg" CHECK ("standard_cost" >= 0);
ALTER TABLE "items" ADD CONSTRAINT "items_reorder_point_nonneg" CHECK ("reorder_point" >= 0);
ALTER TABLE "items" ADD CONSTRAINT "items_reorder_qty_nonneg" CHECK ("reorder_qty" >= 0);

-- PO lines: positive order quantity, non-negative price.
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_items_qty_ordered_pos" CHECK ("qty_ordered" > 0);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_items_qty_received_nonneg" CHECK ("qty_received" >= 0);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "po_items_unit_price_nonneg" CHECK ("unit_price" >= 0);

-- PO header monetary totals are non-negative.
ALTER TABLE "purchase_orders" ADD CONSTRAINT "po_subtotal_nonneg" CHECK ("subtotal" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "po_vat_nonneg" CHECK ("vat_amount" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "po_ewt_nonneg" CHECK ("ewt_amount" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "po_total_nonneg" CHECK ("total" >= 0);

-- Goods receipt lines: non-negative received/rejected quantities.
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "grn_items_qty_received_nonneg" CHECK ("qty_received" >= 0);
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "grn_items_qty_rejected_nonneg" CHECK ("qty_rejected" >= 0);

-- Requisition / issuance lines: positive requested, non-negative issued.
ALTER TABLE "material_requisition_items" ADD CONSTRAINT "mr_items_qty_requested_pos" CHECK ("qty_requested" > 0);
ALTER TABLE "material_requisition_items" ADD CONSTRAINT "mr_items_qty_issued_nonneg" CHECK ("qty_issued" >= 0);
ALTER TABLE "issuance_items" ADD CONSTRAINT "issuance_items_qty_pos" CHECK ("quantity" > 0);

-- Transfer lines: positive quantity. A transfer of zero is meaningless.
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_qty_pos" CHECK ("quantity" > 0);

-- Adjustment lines: signed but non-zero (an adjustment of zero writes nothing).
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "adj_items_qty_nonzero" CHECK ("qty_delta" <> 0);

-- A stock transfer cannot go from a warehouse to itself.
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_distinct_warehouses" CHECK ("from_warehouse_id" <> "to_warehouse_id");
