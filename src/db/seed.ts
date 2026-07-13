import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import {
  categories,
  companySettings,
  documentSeries,
  items,
  projects,
  roles,
  stockLevels,
  suppliers,
  users,
  warehouses,
  type Role,
  type Uom,
  type VatClass,
} from "./schema";
import { ROLE_LABELS, ROLE_PERMISSIONS, SYSTEM_ROLE_KEYS } from "../lib/rbac";

// Seed runs under tsx (plain Node), so it opens its own connection rather than
// importing @/db — that module is `server-only` and would throw here.
const pgClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(pgClient, { casing: "snake_case" });
const hashPassword = (plain: string) => bcrypt.hash(plain, 12);

/**
 * Idempotent seed. Safe to re-run: it upserts on natural keys and never
 * duplicates. Demo passwords are intentionally weak-but-policy-passing and
 * printed at the end — this is a dev fixture, not production data.
 */

const DEMO_PASSWORD = "Password123!";

const CATEGORIES = [
  { code: "CEM", name: "Cement & Concrete" },
  { code: "AGG", name: "Aggregates" },
  { code: "MAS", name: "Masonry" },
  { code: "STL", name: "Steel" },
  { code: "LUM", name: "Lumber & Formwork" },
  { code: "ROF", name: "Roofing" },
  { code: "PLB", name: "Plumbing" },
  { code: "ELE", name: "Electrical" },
  { code: "HRD", name: "Hardware" },
  { code: "FIN", name: "Finishes" },
] as const;

type CatCode = (typeof CATEGORIES)[number]["code"];

interface SeedItem {
  sku: string;
  name: string;
  cat: CatCode;
  uom: Uom;
  cost: string;
  reorderPoint: string;
  reorderQty: string;
  weatherSensitive?: boolean;
  weightKgPerUom?: string;
  vatClass?: VatClass;
  dpwhPayItem?: string;
}

// Costs are VAT-exclusive PHP, mid-point of the researched market range.
const ITEMS: SeedItem[] = [
  { sku: "CEM-PC40", name: "Portland Cement Type 1 (40kg)", cat: "CEM", uom: "BAG", cost: "300.00", reorderPoint: "200", reorderQty: "500", weatherSensitive: true, weightKgPerUom: "40", dpwhPayItem: "405" },
  { sku: "CEM-POZ40", name: "Pozzolan / Masonry Cement (40kg)", cat: "CEM", uom: "BAG", cost: "260.00", reorderPoint: "100", reorderQty: "300", weatherSensitive: true, weightKgPerUom: "40" },
  { sku: "CEM-RMC-A", name: "Ready-mix Concrete Class A (~3000psi)", cat: "CEM", uom: "CU_M", cost: "5500.00", reorderPoint: "0", reorderQty: "0", dpwhPayItem: "405" },
  { sku: "AGG-SAND", name: "Washed River Sand (fine aggregate)", cat: "AGG", uom: "CU_M", cost: "1300.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "AGG-G34", name: 'Gravel 3/4" (coarse aggregate)', cat: "AGG", uom: "CU_M", cost: "1300.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "AGG-G1", name: "Crushed Gravel G-1 / Base Course", cat: "AGG", uom: "CU_M", cost: "1250.00", reorderPoint: "10", reorderQty: "40" },
  { sku: "MAS-CHB4", name: 'CHB 4" Load-bearing', cat: "MAS", uom: "PC", cost: "20.00", reorderPoint: "500", reorderQty: "2000" },
  { sku: "MAS-CHB5", name: 'CHB 5"', cat: "MAS", uom: "PC", cost: "22.00", reorderPoint: "300", reorderQty: "1000" },
  { sku: "MAS-CHB6", name: 'CHB 6" Load-bearing', cat: "MAS", uom: "PC", cost: "26.00", reorderPoint: "300", reorderQty: "1000" },
  { sku: "STL-RB10", name: "Deformed Rebar 10mm x 6m (Gr.40)", cat: "STL", uom: "LENGTH", cost: "180.00", reorderPoint: "100", reorderQty: "300", weightKgPerUom: "3.700", dpwhPayItem: "404" },
  { sku: "STL-RB12", name: "Deformed Rebar 12mm x 6m (Gr.40)", cat: "STL", uom: "LENGTH", cost: "265.00", reorderPoint: "100", reorderQty: "300", weightKgPerUom: "5.328", dpwhPayItem: "404" },
  { sku: "STL-RB16", name: "Deformed Rebar 16mm x 6m (Gr.60)", cat: "STL", uom: "LENGTH", cost: "465.00", reorderPoint: "80", reorderQty: "240", weightKgPerUom: "9.462", dpwhPayItem: "404" },
  { sku: "STL-RB20", name: "Deformed Rebar 20mm x 6m (Gr.60)", cat: "STL", uom: "LENGTH", cost: "720.00", reorderPoint: "60", reorderQty: "180", weightKgPerUom: "14.790", dpwhPayItem: "404" },
  { sku: "STL-RB25", name: "Deformed Rebar 25mm x 6m (Gr.60)", cat: "STL", uom: "LENGTH", cost: "1140.00", reorderPoint: "40", reorderQty: "120", weightKgPerUom: "23.110", dpwhPayItem: "404" },
  { sku: "STL-TW16", name: "G.I. Tie Wire #16", cat: "STL", uom: "KG", cost: "90.00", reorderPoint: "100", reorderQty: "300" },
  { sku: "STL-WWM", name: "Welded Wire Mesh / Steel Matting", cat: "STL", uom: "SHEET", cost: "1600.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "STL-CPUR", name: "Steel C-Purlins / Angle Bar", cat: "STL", uom: "LENGTH", cost: "600.00", reorderPoint: "50", reorderQty: "150" },
  { sku: "LUM-COCO", name: "Coco Lumber (rough)", cat: "LUM", uom: "BD_FT", cost: "35.00", reorderPoint: "500", reorderQty: "2000", weatherSensitive: true },
  { sku: "LUM-GOOD", name: "Good Lumber (kiln-dried)", cat: "LUM", uom: "BD_FT", cost: "72.00", reorderPoint: "300", reorderQty: "1000", weatherSensitive: true },
  { sku: "LUM-PHEN", name: 'Phenolic Board 3/4" (4x8)', cat: "LUM", uom: "SHEET", cost: "1150.00", reorderPoint: "40", reorderQty: "120", weatherSensitive: true },
  { sku: "LUM-PLY12", name: 'Ordinary Plywood 1/2" (4x8)', cat: "LUM", uom: "SHEET", cost: "675.00", reorderPoint: "50", reorderQty: "150", weatherSensitive: true },
  { sku: "LUM-MAR34", name: 'Marine Plywood 3/4" (4x8)', cat: "LUM", uom: "SHEET", cost: "1300.00", reorderPoint: "30", reorderQty: "90", weatherSensitive: true },
  { sku: "ROF-GI26", name: "G.I. Corrugated Roofing ga.26", cat: "ROF", uom: "LM", cost: "315.00", reorderPoint: "100", reorderQty: "300" },
  { sku: "ROF-LS26", name: "Pre-painted Long-span Roofing ga.26", cat: "ROF", uom: "LM", cost: "400.00", reorderPoint: "80", reorderQty: "240" },
  { sku: "ROF-NAIL", name: "Umbrella / Roofing Nails", cat: "ROF", uom: "KG", cost: "115.00", reorderPoint: "30", reorderQty: "90" },
  { sku: "PLB-PVC50", name: 'PVC Pipe 50mm (2") S-1000', cat: "PLB", uom: "LENGTH", cost: "585.00", reorderPoint: "40", reorderQty: "120" },
  { sku: "PLB-PVC100", name: 'PVC Pipe 100mm (4") Sanitary', cat: "PLB", uom: "LENGTH", cost: "1150.00", reorderPoint: "30", reorderQty: "90" },
  { sku: "PLB-GI25", name: 'G.I. Pipe 25.4mm (1")', cat: "PLB", uom: "LENGTH", cost: "1775.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "PLB-PPR20", name: "PPR Pipe 20mm (hot/cold)", cat: "PLB", uom: "LENGTH", cost: "250.00", reorderPoint: "40", reorderQty: "120" },
  { sku: "PLB-GATE", name: "Gate Valve / Faucet (brass)", cat: "PLB", uom: "PC", cost: "575.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "ELE-THHN35", name: "THHN Wire 3.5mm2 (roll 150m)", cat: "ELE", uom: "ROLL", cost: "3300.00", reorderPoint: "10", reorderQty: "30" },
  { sku: "ELE-COND", name: "PVC Electrical Conduit + Fittings", cat: "ELE", uom: "LENGTH", cost: "155.00", reorderPoint: "50", reorderQty: "150" },
  { sku: "ELE-JBOX", name: "Utility / Junction Box", cat: "ELE", uom: "PC", cost: "30.00", reorderPoint: "100", reorderQty: "300" },
  { sku: "HRD-CWN", name: "Common Wire Nails (assorted)", cat: "HRD", uom: "KG", cost: "80.00", reorderPoint: "100", reorderQty: "300" },
  { sku: "HRD-CN", name: "Concrete Nails (CWN)", cat: "HRD", uom: "KG", cost: "105.00", reorderPoint: "50", reorderQty: "150" },
  { sku: "FIN-SKIM", name: "Skim Coat / Plaster (25kg)", cat: "FIN", uom: "BAG", cost: "335.00", reorderPoint: "40", reorderQty: "120", weatherSensitive: true },
  { sku: "FIN-TILEADH", name: "Tile Adhesive (25kg)", cat: "FIN", uom: "BAG", cost: "350.00", reorderPoint: "40", reorderQty: "120", weatherSensitive: true },
  { sku: "FIN-TILE60", name: "Ceramic Floor Tile 60x60", cat: "FIN", uom: "PC", cost: "220.00", reorderPoint: "100", reorderQty: "300" },
  { sku: "FIN-PAINT", name: "Latex / Enamel Paint (4L gal)", cat: "FIN", uom: "GAL", cost: "950.00", reorderPoint: "20", reorderQty: "60" },
  { sku: "FIN-WPROOF", name: "Cementitious Waterproofing (pail)", cat: "FIN", uom: "PAIL", cost: "3000.00", reorderPoint: "10", reorderQty: "30" },
  { sku: "FIN-GYP12", name: 'Gypsum Board 1/2" (4x8)', cat: "FIN", uom: "SHEET", cost: "475.00", reorderPoint: "40", reorderQty: "120", weatherSensitive: true },
];

const DEMO_USERS: { email: string; fullName: string; role: Role }[] = [
  { email: "admin@ims.ph", fullName: "System Administrator", role: "ADMIN" },
  { email: "pm@ims.ph", fullName: "Ramon Dela Cruz", role: "PROJECT_MANAGER" },
  { email: "procurement@ims.ph", fullName: "Liza Santos", role: "PROCUREMENT_OFFICER" },
  { email: "bodega@ims.ph", fullName: "Boy Reyes", role: "WAREHOUSEMAN" },
  { email: "engineer@ims.ph", fullName: "Engr. Aling Mercado", role: "SITE_ENGINEER" },
  { email: "accountant@ims.ph", fullName: "Grace Villanueva", role: "ACCOUNTANT" },
  { email: "auditor@ims.ph", fullName: "Nestor Aquino", role: "AUDITOR" },
  { email: "viewer@ims.ph", fullName: "Client Viewer", role: "VIEWER" },
];

const SERIES = [
  { series: "PO" as const, prefix: "PO" },
  { series: "GRN" as const, prefix: "GRN" },
  { series: "MR" as const, prefix: "MR" },
  { series: "ISSUANCE" as const, prefix: "MIS" },
  { series: "TRANSFER" as const, prefix: "STS" },
  { series: "ADJUSTMENT" as const, prefix: "ADJ" },
];

async function seed() {
  console.log("Seeding IMS…");

  // Company settings (single row).
  await db
    .insert(companySettings)
    .values({
      id: 1,
      name: "JuanBuild Construction Corp.",
      tin: "009-123-456-000",
      address: "123 Katipunan Ave, Quezon City, Metro Manila",
      pcabLicenseNo: "PCAB-00012345",
      vatRegistered: true,
      isTopWithholdingAgent: true,
    })
    .onConflictDoNothing();

  // Document series.
  for (const s of SERIES) {
    await db.insert(documentSeries).values(s).onConflictDoNothing();
  }

  // Categories.
  const catByCode = new Map<string, string>();
  for (const c of CATEGORIES) {
    const [row] = await db
      .insert(categories)
      .values(c)
      .onConflictDoUpdate({ target: categories.code, set: { name: c.name } })
      .returning({ id: categories.id, code: categories.code });
    catByCode.set(row.code, row.id);
  }

  // Items.
  const itemBySku = new Map<string, string>();
  for (const it of ITEMS) {
    const categoryId = catByCode.get(it.cat);
    if (!categoryId) throw new Error(`Unknown category ${it.cat} for ${it.sku}`);
    const [row] = await db
      .insert(items)
      .values({
        sku: it.sku,
        name: it.name,
        categoryId,
        uom: it.uom,
        standardCost: it.cost,
        reorderPoint: it.reorderPoint,
        reorderQty: it.reorderQty,
        isWeatherSensitive: it.weatherSensitive ?? false,
        weightKgPerUom: it.weightKgPerUom ?? null,
        vatClass: it.vatClass ?? "VATABLE",
        dpwhPayItem: it.dpwhPayItem ?? null,
      })
      .onConflictDoUpdate({
        target: items.sku,
        set: { name: it.name, standardCost: it.cost, categoryId },
      })
      .returning({ id: items.id, sku: items.sku });
    itemBySku.set(row.sku, row.id);
  }

  // Projects.
  const [proj1] = await db
    .insert(projects)
    .values({
      code: "PRJ-2026-001",
      name: "Ortigas Mid-Rise Tower",
      clientName: "Meridian Land Inc.",
      location: "Pasig City, Metro Manila",
      status: "ACTIVE",
      startDate: "2026-02-01",
      targetEndDate: "2027-08-31",
      contractAmount: "185000000.00",
    })
    .onConflictDoUpdate({ target: projects.code, set: { status: "ACTIVE" } })
    .returning({ id: projects.id });

  await db
    .insert(projects)
    .values({
      code: "PRJ-2026-002",
      name: "Cavite Warehouse Complex",
      clientName: "SwiftLogistics Corp.",
      location: "Dasmariñas, Cavite",
      status: "PLANNING",
      startDate: "2026-09-01",
      contractAmount: "62000000.00",
    })
    .onConflictDoNothing();

  // Warehouses: one central, one bodega per project.
  const [mainWh] = await db
    .insert(warehouses)
    .values({ code: "WH-MAIN", name: "Central Warehouse — QC", kind: "MAIN_WAREHOUSE" })
    .onConflictDoUpdate({ target: warehouses.code, set: { name: "Central Warehouse — QC" } })
    .returning({ id: warehouses.id });

  await db
    .insert(warehouses)
    .values({
      code: "WH-ORTIGAS",
      name: "Ortigas Tower Jobsite Bodega",
      kind: "SITE_BODEGA",
      projectId: proj1?.id,
    })
    .onConflictDoNothing();

  // Suppliers.
  await db
    .insert(suppliers)
    .values([
      {
        code: "SUP-HORME",
        name: "Hormel Hardware & Construction Supply",
        tin: "123-456-789-000",
        vatStatus: "VAT_REGISTERED",
        ewtApplicable: true,
        ewtRate: "0.0100",
        atcCode: "WC158",
        contactPerson: "Mr. Tan",
        phone: "0917-000-1111",
        leadTimeDays: 3,
      },
      {
        code: "SUP-REPUBLIC",
        name: "Republic Cement Sales",
        tin: "222-333-444-000",
        vatStatus: "VAT_REGISTERED",
        ewtApplicable: true,
        ewtRate: "0.0100",
        atcCode: "WC158",
        leadTimeDays: 5,
      },
      {
        code: "SUP-STEELASIA",
        name: "SteelAsia Manufacturing",
        tin: "555-666-777-000",
        vatStatus: "VAT_REGISTERED",
        ewtApplicable: true,
        ewtRate: "0.0100",
        atcCode: "WC158",
        leadTimeDays: 7,
      },
      {
        code: "SUP-LOCAL",
        name: "Aling Nena Sand & Gravel (Non-VAT)",
        tin: "888-999-000-000",
        vatStatus: "NON_VAT",
        ewtApplicable: true,
        ewtRate: "0.0100",
        atcCode: "WC158",
        leadTimeDays: 1,
      },
    ])
    .onConflictDoNothing();

  // Opening stock at the central warehouse for a handful of fast movers, so
  // the dashboard is not empty on first run. Uses standardCost as avg cost.
  const opening: { sku: string; qty: string }[] = [
    { sku: "CEM-PC40", qty: "480" },
    { sku: "STL-RB12", qty: "260" },
    { sku: "MAS-CHB6", qty: "1800" },
    { sku: "LUM-PLY12", qty: "42" },
    { sku: "AGG-SAND", qty: "55" },
    { sku: "STL-TW16", qty: "40" }, // below reorder on purpose (low-stock demo)
  ];
  if (mainWh) {
    for (const o of opening) {
      const itemId = itemBySku.get(o.sku);
      const item = ITEMS.find((i) => i.sku === o.sku)!;
      if (!itemId) continue;
      await db
        .insert(stockLevels)
        .values({
          itemId,
          warehouseId: mainWh.id,
          qtyOnHand: o.qty,
          avgUnitCost: item.cost,
        })
        .onConflictDoUpdate({
          target: [stockLevels.itemId, stockLevels.warehouseId],
          set: { qtyOnHand: o.qty, avgUnitCost: item.cost },
        });
    }
  }

  // Roles must exist before users (users.role is a FK to roles.key).
  // onConflictDoNothing so re-seeding never clobbers permissions an admin edited.
  for (const key of SYSTEM_ROLE_KEYS) {
    await db
      .insert(roles)
      .values({
        key,
        label: ROLE_LABELS[key],
        isSystem: true,
        permissions: [...ROLE_PERMISSIONS[key]],
      })
      .onConflictDoNothing();
  }

  // Users.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    await db
      .insert(users)
      .values({ ...u, passwordHash })
      .onConflictDoNothing();
  }

  console.log(`✓ ${CATEGORIES.length} categories, ${ITEMS.length} items, ${DEMO_USERS.length} users`);
  console.log(`✓ Demo login password for every account: ${DEMO_PASSWORD}`);
  console.log("  e.g. admin@ims.ph / bodega@ims.ph / procurement@ims.ph");
}

seed()
  .then(() => pgClient.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    pgClient.end();
    process.exit(1);
  });
