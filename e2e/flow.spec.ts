/* eslint-disable @typescript-eslint/no-explicit-any -- test glue reads dynamic API JSON */
import { expect, test, type APIRequestContext } from "@playwright/test";
import { USERS, contextFor, expectOk } from "./helpers";

/**
 * End-to-end procurement and requisition flows, driven through the REST API
 * with each step performed by the correct role. This proves both the happy
 * path (stock actually moves) and separation of duties (the same person
 * cannot create and approve).
 *
 * Runs serially against seeded data; asserts on relative stock deltas so it is
 * safe to re-run.
 */

const MAIN_WAREHOUSE = "WH-MAIN";
const CEMENT_SKU = "CEM-PC40";

async function findId(req: APIRequestContext, path: string, match: (row: any) => boolean) {
  const rows = await expectOk(await req.get(path));
  const row = (rows as any[]).find(match);
  expect(row, `no row in ${path} matching predicate`).toBeTruthy();
  return row;
}

async function stockQty(req: APIRequestContext, sku: string, warehouseCode: string): Promise<number> {
  const rows = (await expectOk(await req.get("/api/stock"))) as any[];
  const row = rows.find(
    (r) => (r.sku === sku || r.itemSku === sku) && (r.warehouseName?.includes("Central") || r.warehouseCode === warehouseCode),
  );
  return row ? Number(row.qtyOnHand) : 0;
}

test("PO -> approve -> GRN increases stock, with separation of duties enforced", async ({ browser }) => {
  const proc = await contextFor(browser, USERS.procurement);
  const pm = await contextFor(browser, USERS.pm);
  const bodega = await contextFor(browser, USERS.bodega);

  try {
    const supplier = await findId(proc.page.request, "/api/suppliers", (r) => r.code === "SUP-REPUBLIC");
    const warehouse = await findId(proc.page.request, "/api/warehouses", (r) => r.code === MAIN_WAREHOUSE);
    const item = await findId(proc.page.request, "/api/items", (r) => r.sku === CEMENT_SKU);

    const before = await stockQty(bodega.page.request, CEMENT_SKU, MAIN_WAREHOUSE);

    // 1. Procurement raises a PO for 100 bags.
    const po = await expectOk(
      await proc.page.request.post("/api/purchase-orders", {
        data: {
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          orderDate: "2026-07-11",
          lines: [{ itemId: item.id, qtyOrdered: "100", unitPrice: "300.00", vatClass: "VATABLE" }],
        },
      }),
    );
    expect(po.poNumber).toMatch(/^PO-/);

    // 2. Separation of duties: procurement cannot approve its own PO.
    const selfApprove = await proc.page.request.post(`/api/purchase-orders/${po.id}/approve`);
    expect(selfApprove.status(), "self-approval must be forbidden").toBe(403);

    // 3. The project manager approves it.
    await expectOk(await pm.page.request.post(`/api/purchase-orders/${po.id}/approve`));

    // 4. The warehouseman receives all 100 bags. Fetch the PO line id first.
    const poDetail = await expectOk(await bodega.page.request.get(`/api/purchase-orders/${po.id}`));
    const poLine = poDetail.lines[0];
    const grn = await expectOk(
      await bodega.page.request.post("/api/goods-receipts", {
        data: {
          poId: po.id,
          supplierDrNumber: "DR-TEST-001",
          receivedDate: "2026-07-11",
          lines: [{ poItemId: poLine.id, qtyReceived: "100", qtyRejected: "0" }],
        },
      }),
    );
    expect(grn.grnNumber).toMatch(/^GRN-/);

    // 5. Stock rose by exactly 100 bags.
    const after = await stockQty(bodega.page.request, CEMENT_SKU, MAIN_WAREHOUSE);
    expect(after - before).toBeCloseTo(100, 3);
  } finally {
    await proc.context.close();
    await pm.context.close();
    await bodega.context.close();
  }
});

test("MR -> approve -> issue decreases stock", async ({ browser }) => {
  const engineer = await contextFor(browser, USERS.engineer);
  const pm = await contextFor(browser, USERS.pm);
  const bodega = await contextFor(browser, USERS.bodega);

  try {
    const project = await findId(engineer.page.request, "/api/projects", (r) => r.code?.startsWith("PRJ-"));
    const warehouse = await findId(engineer.page.request, "/api/warehouses", (r) => r.code === MAIN_WAREHOUSE);
    const item = await findId(engineer.page.request, "/api/items", (r) => r.sku === CEMENT_SKU);

    const before = await stockQty(bodega.page.request, CEMENT_SKU, MAIN_WAREHOUSE);

    // 1. Site engineer requisitions 20 bags.
    const mr = await expectOk(
      await engineer.page.request.post("/api/requisitions", {
        data: {
          projectId: project.id,
          warehouseId: warehouse.id,
          neededDate: "2026-07-12",
          lines: [{ itemId: item.id, qtyRequested: "20" }],
        },
      }),
    );

    // 2. Engineer cannot approve their own MR.
    const selfApprove = await engineer.page.request.post(`/api/requisitions/${mr.id}/approve`);
    expect(selfApprove.status()).toBe(403);

    // 3. PM approves (reserves the stock).
    await expectOk(await pm.page.request.post(`/api/requisitions/${mr.id}/approve`));

    // 4. Warehouseman issues all 20 bags.
    const mrDetail = await expectOk(await bodega.page.request.get(`/api/requisitions/${mr.id}`));
    const mrLine = mrDetail.lines[0];
    await expectOk(
      await bodega.page.request.post("/api/issuances", {
        data: {
          mrId: mr.id,
          receivedByName: "Foreman Pedro",
          lines: [{ mrItemId: mrLine.id, quantity: "20" }],
        },
      }),
    );

    // 5. Stock fell by exactly 20 bags.
    const after = await stockQty(bodega.page.request, CEMENT_SKU, MAIN_WAREHOUSE);
    expect(before - after).toBeCloseTo(20, 3);
  } finally {
    await engineer.context.close();
    await pm.context.close();
    await bodega.context.close();
  }
});
