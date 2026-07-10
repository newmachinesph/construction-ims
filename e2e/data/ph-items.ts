/**
 * ~240 realistic Philippine hardware / construction catalog items, mapped to
 * the 10 seeded categories. Consumed by seed-ui.spec.ts, which creates each one
 * through the real item form and uploads a web-sourced photo.
 *
 * Category names MUST match the seeded categories exactly (the form's category
 * <select> uses the name as the option label). `uom` is the enum key (the
 * <select> option value). `keyword` drives the stock-photo lookup.
 */

export interface SeedItem {
  sku: string;
  name: string;
  category: string;
  uom: string;
  cost: string;
  reorderPoint: string;
  reorderQty: string;
  keyword: string;
  weatherSensitive?: boolean;
}

const items: SeedItem[] = [];
const counters: Record<string, number> = {};

function add(
  prefix: string,
  category: string,
  keyword: string,
  name: string,
  uom: string,
  cost: number,
  opts: { rp?: number; rq?: number; wx?: boolean } = {},
) {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  const n = String(counters[prefix]).padStart(3, "0");
  items.push({
    sku: `${prefix}-${n}`,
    name,
    category,
    uom,
    cost: cost.toFixed(2),
    reorderPoint: String(opts.rp ?? 50),
    reorderQty: String(opts.rq ?? 150),
    keyword,
    weatherSensitive: opts.wx,
  });
}

/* ------------------------------ Steel ------------------------------- */
const STEEL = "Steel";
const rebarWeight: Record<number, number> = { 8: 2.37, 10: 3.7, 12: 5.33, 16: 9.46, 20: 14.79, 25: 23.1, 28: 28.98, 32: 37.9 };
for (const d of [8, 10, 12, 16, 20, 25, 28, 32]) {
  for (const g of [40, 60]) {
    const base = rebarWeight[d] * (g === 60 ? 52 : 49); // ~PHP/kg by grade
    add("STL", STEEL, "steel,rebar", `Deformed Rebar ${d}mm x 6m (Grade ${g})`, "LENGTH", Math.round(base), { rp: 80, rq: 240 });
  }
}
for (const s of ['1" x 1"', '1-1/2" x 1-1/2"', '2" x 2"']) add("STL", STEEL, "steel,angle", `Angle Bar ${s} x 6m`, "LENGTH", 380 + Math.random() * 400);
for (const s of ['3/16" x 1"', '1/4" x 2"']) add("STL", STEEL, "steel,bar", `Flat Bar ${s} x 6m`, "LENGTH", 300 + Math.random() * 300);
for (const s of ["2x3", "2x4", "2x6"]) for (const t of ["1.2mm", "1.5mm", "2.0mm"]) add("STL", STEEL, "steel,purlin", `C-Purlins ${s} (${t}) x 6m`, "LENGTH", 450 + Math.random() * 500);
for (const ga of [26, 24, 22]) add("STL", STEEL, "steel,sheet", `G.I. Plain Sheet ga.${ga} (4x8)`, "SHEET", 700 + (28 - ga) * 120);
add("STL", STEEL, "steel,wire", "G.I. Tie Wire #16", "KG", 90, { rp: 100, rq: 300 });
add("STL", STEEL, "steel,wire", "G.I. Tie Wire #18", "KG", 95, { rp: 60, rq: 180 });
add("STL", STEEL, "steel,welding", "Welding Rod E6013 1/8 (per kg)", "KG", 120, { rp: 40, rq: 120 });
add("STL", STEEL, "steel,mesh", "Welded Wire Mesh 6mm (2x6m)", "SHEET", 1650, { rp: 20, rq: 60 });
add("STL", STEEL, "steel,mesh", "Hog Wire / Cyclone Wire (per roll)", "ROLL", 2200, { rp: 10, rq: 30 });
add("STL", STEEL, "steel,tube", 'Square Tube 1" x 1" (1.2mm) x 6m', "LENGTH", 420);
add("STL", STEEL, "steel,tube", 'Square Tube 2" x 2" (1.5mm) x 6m', "LENGTH", 780);
add("STL", STEEL, "steel,tube", 'G.I. Tube 2" x 3" (1.5mm) x 6m', "LENGTH", 950);
add("STL", STEEL, "steel,deck", "Metal Deck ga.24 (per lm)", "LM", 520, { rp: 60, rq: 180 });

/* -------------------------- Cement & Concrete ----------------------- */
const CEM = "Cement & Concrete";
add("CEM", CEM, "cement", "Portland Cement Type 1 (40kg)", "BAG", 300, { rp: 200, rq: 500, wx: true });
add("CEM", CEM, "cement", "Portland Cement Type 1P (40kg)", "BAG", 290, { rp: 150, rq: 400, wx: true });
add("CEM", CEM, "cement", "Pozzolan / Masonry Cement (40kg)", "BAG", 260, { rp: 100, rq: 300, wx: true });
add("CEM", CEM, "cement", "White Cement (40kg)", "BAG", 780, { rp: 20, rq: 60, wx: true });
for (const c of ["A (~3000psi)", "B (~2500psi)", "AA (~4000psi)"]) add("CEM", CEM, "concrete", `Ready-mix Concrete Class ${c}`, "CU_M", 5200 + Math.random() * 1600, { rp: 0, rq: 0 });
add("CEM", CEM, "cement,grout", "Non-shrink Grout (25kg)", "BAG", 620, { rp: 20, rq: 60, wx: true });
add("CEM", CEM, "concrete", "Concrete Hardener / Floor Topping (25kg)", "BAG", 900, { rp: 15, rq: 45, wx: true });
add("CEM", CEM, "concrete", "Concrete Bonding Agent (4L)", "GAL", 850, { rp: 10, rq: 30 });
add("CEM", CEM, "concrete", "Concrete Retarder Admixture (1L)", "L", 240, { rp: 20, rq: 60 });

/* ----------------------------- Aggregates --------------------------- */
const AGG = "Aggregates";
add("AGG", AGG, "sand", "Washed River Sand", "CU_M", 1300, { rp: 20, rq: 60 });
add("AGG", AGG, "sand", "S-1 Fine Sand", "CU_M", 1150, { rp: 15, rq: 45 });
add("AGG", AGG, "sand", "Vibro Sand", "CU_M", 1250, { rp: 15, rq: 45 });
add("AGG", AGG, "gravel", 'Gravel 3/4" (coarse)', "CU_M", 1300, { rp: 20, rq: 60 });
add("AGG", AGG, "gravel", 'Gravel 3/8" (pea)', "CU_M", 1350, { rp: 15, rq: 45 });
add("AGG", AGG, "gravel", "Crushed Gravel G-1 / Base Course", "CU_M", 1250, { rp: 10, rq: 40 });
add("AGG", AGG, "gravel", "Item 200 Aggregate Sub-base", "CU_M", 1100, { rp: 10, rq: 40 });
add("AGG", AGG, "rock", "Boulders / Riprap (per cu.m)", "CU_M", 900, { rp: 5, rq: 20 });
add("AGG", AGG, "gravel", "Armor Rock (per ton)", "TON", 1400, { rp: 5, rq: 20 });

/* ------------------------------ Masonry ----------------------------- */
const MAS = "Masonry";
for (const s of [4, 5, 6]) add("MAS", MAS, "concrete,block", `CHB ${s}" Load-bearing`, "PC", 18 + s * 1.5, { rp: 400, rq: 1500 });
add("MAS", MAS, "concrete,block", 'CHB 4" Non-load-bearing', "PC", 16, { rp: 500, rq: 2000 });
add("MAS", MAS, "brick", "Red Clay Brick", "PC", 12, { rp: 500, rq: 2000 });
add("MAS", MAS, "brick", "Adobe Block (natural)", "PC", 45, { rp: 200, rq: 600 });
add("MAS", MAS, "block", "Decorative Breeze Block", "PC", 65, { rp: 100, rq: 300 });
add("MAS", MAS, "block", "AAC Lightweight Block 4in", "PC", 55, { rp: 200, rq: 600 });

/* ------------------------ Lumber & Formwork ------------------------- */
const LUM = "Lumber & Formwork";
for (const s of ['2" x 2"', '2" x 3"', '2" x 4"']) add("LUM", LUM, "lumber", `Coco Lumber ${s} x 12ft`, "BD_FT", 30 + Math.random() * 15, { rp: 500, rq: 2000, wx: true });
for (const s of ['2" x 2"', '2" x 4"', '2" x 6"']) add("LUM", LUM, "lumber", `Good Lumber (kiln-dried) ${s} x 10ft`, "BD_FT", 60 + Math.random() * 30, { rp: 300, rq: 1000, wx: true });
add("LUM", LUM, "plywood", 'Ordinary Plywood 1/4" (4x8)', "SHEET", 420, { rp: 40, rq: 120, wx: true });
add("LUM", LUM, "plywood", 'Ordinary Plywood 1/2" (4x8)', "SHEET", 675, { rp: 50, rq: 150, wx: true });
add("LUM", LUM, "plywood", 'Marine Plywood 1/2" (4x8)', "SHEET", 980, { rp: 30, rq: 90, wx: true });
add("LUM", LUM, "plywood", 'Marine Plywood 3/4" (4x8)', "SHEET", 1300, { rp: 30, rq: 90, wx: true });
add("LUM", LUM, "plywood", 'Phenolic Board 3/4" (4x8)', "SHEET", 1150, { rp: 40, rq: 120, wx: true });
add("LUM", LUM, "wood", "Hardiflex / Fiber Cement Board 4.5mm (4x8)", "SHEET", 520, { rp: 40, rq: 120, wx: true });
add("LUM", LUM, "lumber", "Formworks Bracing Lumber (set)", "SET", 1500, { rp: 10, rq: 30, wx: true });

/* ------------------------------ Roofing ----------------------------- */
const ROF = "Roofing";
for (const ga of [26, 24]) add("ROF", ROF, "roof,metal", `G.I. Corrugated Roofing ga.${ga} (per lm)`, "LM", 300 + (28 - ga) * 40, { rp: 100, rq: 300 });
for (const c of ["Red", "Green", "Blue", "Gray"]) add("ROF", ROF, "roof,metal", `Pre-painted Long-span Rib-type ga.26 (${c}, per lm)`, "LM", 400, { rp: 80, rq: 240 });
add("ROF", ROF, "roof", "Ridge Roll ga.26 (per pc)", "PC", 320, { rp: 40, rq: 120 });
add("ROF", ROF, "roof", "Gutter ga.26 (per lm)", "LM", 280, { rp: 40, rq: 120 });
add("ROF", ROF, "roof", "Spanish Clay Roof Tile", "PC", 55, { rp: 200, rq: 600 });
add("ROF", ROF, "roof", "Polycarbonate Roofing Sheet (per lm)", "LM", 650, { rp: 30, rq: 90 });
add("ROF", ROF, "roof", "Roof Insulation Foil (per sq.m)", "SQ_M", 120, { rp: 100, rq: 300 });
add("ROF", ROF, "roof", "Umbrella / Roofing Nails (per kg)", "KG", 115, { rp: 30, rq: 90 });
add("ROF", ROF, "roof", "Tekscrew / Roofing Screws (per box)", "SET", 480, { rp: 20, rq: 60 });

/* ------------------------------ Plumbing ---------------------------- */
const PLB = "Plumbing";
for (const d of ['1/2"', '3/4"', '1"', '2"', '3"', '4"', '6"']) {
  add("PLB", PLB, "pipe,pvc", `PVC Pipe ${d} S-1000 (Sanitary)`, "LENGTH", 180 + parseFloat(d) * 300);
}
for (const d of ['1/2"', '3/4"', '1"']) add("PLB", PLB, "pipe", `PPR Pipe ${d} PN20 (hot/cold)`, "LENGTH", 180 + parseFloat(d) * 220);
for (const d of ['1/2"', '3/4"', '1"', '2"']) add("PLB", PLB, "pipe,gi", `G.I. Pipe ${d} Schedule 40`, "LENGTH", 900 + parseFloat(d) * 700);
for (const f of ["Elbow 90", "Tee", "Coupling", "Reducer", "Wye"]) for (const d of ['2"', '4"']) add("PLB", PLB, "pipe,fitting", `PVC ${f} ${d}`, "PC", f.includes("Wye") ? 120 : 45, { rp: 100, rq: 300 });
add("PLB", PLB, "valve", "Gate Valve 1/2 (brass)", "PC", 250, { rp: 20, rq: 60 });
add("PLB", PLB, "valve", "Ball Valve 3/4 (brass)", "PC", 320, { rp: 20, rq: 60 });
add("PLB", PLB, "faucet", "Faucet / Bibb Cock (chrome)", "PC", 350, { rp: 20, rq: 60 });
add("PLB", PLB, "plumbing", "Water Closet (2-piece)", "SET", 3800, { rp: 5, rq: 15 });
add("PLB", PLB, "plumbing", "Lavatory / Wash Basin", "SET", 1600, { rp: 5, rq: 15 });
add("PLB", PLB, "plumbing", "Floor Drain Stainless 4x4", "PC", 180, { rp: 30, rq: 90 });
add("PLB", PLB, "plumbing", "P-Trap PVC 2", "PC", 120, { rp: 30, rq: 90 });
add("PLB", PLB, "plumbing", "PVC Solvent Cement (400cc)", "PC", 220, { rp: 30, rq: 90 });
add("PLB", PLB, "plumbing", "Teflon Tape (per pc)", "PC", 18, { rp: 100, rq: 300 });

/* ----------------------------- Electrical --------------------------- */
const ELE = "Electrical";
for (const mm of [1.25, 2.0, 3.5, 5.5, 8.0, 14, 22, 38]) add("ELE", ELE, "electrical,wire", `THHN Stranded Wire ${mm}mm2 (per m)`, "M", 12 + mm * 4, { rp: 200, rq: 600 });
add("ELE", ELE, "electrical,wire", "Flat Cord #16 (per m)", "M", 22, { rp: 100, rq: 300 });
for (const d of ['1/2"', '3/4"', '1"']) add("ELE", ELE, "electrical,conduit", `PVC Electrical Conduit ${d} (per length)`, "LENGTH", 90 + parseFloat(d) * 120);
add("ELE", ELE, "electrical", "Utility Box PVC", "PC", 15, { rp: 200, rq: 600 });
add("ELE", ELE, "electrical", "Junction Box PVC (octagonal)", "PC", 22, { rp: 150, rq: 450 });
for (const a of [15, 20, 30, 40, 60, 100]) add("ELE", ELE, "electrical,breaker", `Circuit Breaker ${a}AT Plug-in`, "PC", 180 + a * 3, { rp: 20, rq: 60 });
add("ELE", ELE, "electrical", "Panel Board 8-branch (with main)", "SET", 2400, { rp: 5, rq: 15 });
add("ELE", ELE, "electrical", "Duplex Convenience Outlet (universal)", "PC", 120, { rp: 40, rq: 120 });
add("ELE", ELE, "electrical", "Single Gang Switch", "PC", 95, { rp: 40, rq: 120 });
add("ELE", ELE, "electrical", "LED Bulb 9W (daylight)", "PC", 110, { rp: 60, rq: 180 });
add("ELE", ELE, "electrical", "LED Panel Light 18W", "PC", 320, { rp: 30, rq: 90 });
add("ELE", ELE, "electrical", "Electrical Tape (big)", "PC", 35, { rp: 100, rq: 300 });
add("ELE", ELE, "electrical", "Wire Staple / Clip (per box)", "SET", 60, { rp: 40, rq: 120 });

/* ------------------------------ Hardware ---------------------------- */
const HRD = "Hardware";
for (const s of ['1"', '1-1/2"', '2"', '2-1/2"', '3"', '4"']) add("HRD", HRD, "nails,hardware", `Common Wire Nails ${s} (per kg)`, "KG", 75 + Math.random() * 25, { rp: 80, rq: 240 });
for (const s of ['1"', '2"', '3"']) add("HRD", HRD, "nails", `Concrete Nails ${s} (per kg)`, "KG", 100 + Math.random() * 30, { rp: 40, rq: 120 });
add("HRD", HRD, "nails", "Finishing Nails (per kg)", "KG", 110, { rp: 30, rq: 90 });
for (const s of ['3/8" x 3"', '1/2" x 4"']) add("HRD", HRD, "bolt", `Machine Bolt w/ Nut ${s}`, "PC", 25, { rp: 100, rq: 300 });
add("HRD", HRD, "bolt", "Expansion Bolt 1/2 (per pc)", "PC", 35, { rp: 100, rq: 300 });
add("HRD", HRD, "screws", "Wood Screw #8 x 2 (per box)", "SET", 180, { rp: 40, rq: 120 });
add("HRD", HRD, "screws", "Metal Screw / Blind Rivet (per box)", "SET", 160, { rp: 40, rq: 120 });
add("HRD", HRD, "hinge", "Door Hinge 4x4 (loose pin)", "PC", 85, { rp: 40, rq: 120 });
add("HRD", HRD, "lock", "Cylindrical Door Lock (knob)", "SET", 520, { rp: 20, rq: 60 });
add("HRD", HRD, "lock", "Padlock 50mm (hardened)", "PC", 240, { rp: 30, rq: 90 });
for (const t of ["Claw Hammer", "Mason Trowel", "Steel Float", "Spirit Level 24in", "Tape Measure 8m", "Hacksaw w/ blade", "Pliers Combination", "Screwdriver Set", "Rubber Mallet", "Chisel Set"])
  add("HRD", HRD, "tools,hardware", t, "PC", 200 + Math.random() * 500, { rp: 10, rq: 30 });
for (const t of ["Wheelbarrow (heavy-duty)", "Shovel (round point)", "Pick Mattock", "Steel Rake", "Bolo / Itak", "Concrete Vibrator Head"])
  add("HRD", HRD, "tools", t, "PC", 800 + Math.random() * 1200, { rp: 5, rq: 15 });
add("HRD", HRD, "abrasive", "Cutting Disc 4in (per pc)", "PC", 35, { rp: 100, rq: 300 });
add("HRD", HRD, "abrasive", "Grinding Disc 4in (per pc)", "PC", 45, { rp: 80, rq: 240 });
add("HRD", HRD, "abrasive", "Sandpaper Assorted (per pc)", "PC", 18, { rp: 100, rq: 300 });
add("HRD", HRD, "safety", "Hard Hat (ANSI)", "PC", 180, { rp: 30, rq: 90 });
add("HRD", HRD, "safety", "Safety Gloves (pair)", "PC", 65, { rp: 60, rq: 180 });
add("HRD", HRD, "safety", "Safety Goggles", "PC", 90, { rp: 40, rq: 120 });

/* ------------------------------ Finishes ---------------------------- */
const FIN = "Finishes";
for (const c of ["White", "Beige", "Gray", "Blue", "Green"]) add("FIN", FIN, "paint", `Latex Paint Semi-Gloss (${c}, 4L)`, "GAL", 950, { rp: 20, rq: 60 });
for (const c of ["White", "Black", "Red Oxide"]) add("FIN", FIN, "paint", `Quick-Dry Enamel (${c}, 4L)`, "GAL", 1050, { rp: 15, rq: 45 });
add("FIN", FIN, "paint", "Flat Wall Enamel (4L)", "GAL", 980, { rp: 15, rq: 45 });
add("FIN", FIN, "paint", "Masonry Neutralizer (4L)", "GAL", 620, { rp: 15, rq: 45 });
add("FIN", FIN, "paint", "Epoxy Primer Gray (4L)", "GAL", 1450, { rp: 10, rq: 30 });
add("FIN", FIN, "paint", "Roofing Paint (4L)", "GAL", 1200, { rp: 10, rq: 30 });
add("FIN", FIN, "finish", "Skim Coat / Wall Putty (25kg)", "BAG", 335, { rp: 40, rq: 120, wx: true });
add("FIN", FIN, "finish", "Tile Adhesive (25kg)", "BAG", 350, { rp: 40, rq: 120, wx: true });
add("FIN", FIN, "finish", "Tile Grout (2kg)", "PC", 120, { rp: 60, rq: 180 });
add("FIN", FIN, "finish", "Cementitious Waterproofing (4kg pail)", "PAIL", 1600, { rp: 15, rq: 45 });
add("FIN", FIN, "finish", "Elastomeric Waterproofing (4L)", "GAL", 1350, { rp: 10, rq: 30 });
add("FIN", FIN, "finish", "Acrylic Sealant / Caulk (per pc)", "PC", 160, { rp: 40, rq: 120 });
for (const s of ["30x30", "40x40", "60x60"]) add("FIN", FIN, "tile", `Ceramic Floor Tile ${s} (per pc)`, "PC", 90 + parseInt(s) * 3, { rp: 100, rq: 300 });
add("FIN", FIN, "tile", "Ceramic Wall Tile 30x60 (per pc)", "PC", 145, { rp: 100, rq: 300 });
add("FIN", FIN, "tile", "Porcelain Tile 60x120 (per pc)", "PC", 620, { rp: 40, rq: 120 });
add("FIN", FIN, "gypsum", 'Gypsum Board 1/2" (4x8)', "SHEET", 475, { rp: 40, rq: 120, wx: true });
add("FIN", FIN, "gypsum", "Metal Furring (per pc)", "PC", 95, { rp: 100, rq: 300 });
add("FIN", FIN, "paint", "Paint Roller w/ Tray (set)", "SET", 180, { rp: 30, rq: 90 });
add("FIN", FIN, "paint", "Paint Brush 3in", "PC", 65, { rp: 60, rq: 180 });

export const PH_ITEMS: readonly SeedItem[] = items;
export const PH_ITEM_COUNT = items.length;
