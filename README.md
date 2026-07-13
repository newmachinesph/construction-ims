# JuanBuild IMS — Philippine Construction Inventory & POS

Inventory, procurement and counter sales for construction firms in the
Philippines. Multi-project, multi-warehouse stock control with BIR-aware tax
handling, role-based access control, and separation-of-duties baked into every
document flow.

**Next.js 16** (App Router, React 19) · **Drizzle ORM** on **PostgreSQL**
(Neon in production, Docker locally) · **Tailwind v4** · a strictly
black-and-white UI.

---

## Why this exists

Generic inventory apps miss what a PH construction firm actually needs:

- **BIR compliance** — 12% VAT (configurable) with per-line VATable /
  zero-rated / exempt classification, 1% (goods) / 2% (services) expanded
  withholding tax for Top Withholding Agents, TIN capture, gapless document
  serials, and post-EOPT (RA 11976) rules where the **Sales Invoice** is the
  primary tax document and the Delivery Receipt is supplementary.
- **Anti-pilferage** — segregation of duties (requester ≠ approver ≠ receiver ≠
  issuer), an append-only stock ledger, and an immutable audit log.
- **Site reality** — central warehouse vs jobsite _bodega_, stock transfers,
  weather-sensitive buffer stock for the June–November typhoon season, and PH
  units (cement bags, rebar lengths, board feet, cu.m).

---

## What it does

**Procurement & stock**
- Purchase orders → approval → goods receipt → stock in, with over-receipt caps
  enforced inside the `UPDATE` (not against a cached read).
- Material requisitions → approval + stock reservation → issuance to site.
- Transfers between warehouses (dispatch → in-transit → receive), valued at the
  cost the goods *left* at, not the source's later average.
- Stock adjustments (count variance, damage, pilferage, spoilage) — always a
  second pair of eyes before they post.
- **Bulk stock import** from CSV, creating any items that don't exist yet.

**Counter sales (POS)**
- A register: search, cart, live VAT totals, cash tender + change.
- Posts a gapless BIR **Sales Invoice**, deducts stock, and freezes the
  moving-average cost onto the sale line so margin stays truthful later.
- **Void** a mis-rung sale: the invoice is *cancelled*, never deleted (the serial
  stays consumed), and stock is restored at the cost it sold at.
- Printable invoice — "Save as PDF" in the print dialog downloads `SI-000123.pdf`.

**Reporting**
- Dashboard sales report over a date range, daily or monthly, with inline-SVG
  charts (no chart library). Voided invoices are excluded from revenue.
- Inventory valuation, low stock, movement ledger — with CSV export.
- Costs and margins are gated behind `report:cost`, so the warehouseman who mans
  the counter never sees them.

---

## Quick start

Prerequisites: **Node 22** (matches CI), Docker Desktop (for a local DB).

```bash
# 1. Install
npm ci

# 2. Environment
cp .env.example .env      # then fill in DATABASE_URL and the R2_* vars

# 3. Database — Postgres in Docker on port 5433 (or point DATABASE_URL at Neon)
docker compose up -d

# 4. Schema + seed (266-item PH catalog, 8 role accounts)
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev               # http://localhost:3000
```

> **Node version matters.** CI and Vercel run Node 22 (npm 10). Generating
> `package-lock.json` on Node 24 (npm 11) produces a tree npm 10 rejects with
> `npm ci` → `EUSAGE`. If you change dependencies, regenerate the lock with
> `npx npm@10 install --package-lock-only`, or move CI and Vercel to Node 24.

### Demo accounts

Every account uses the password **`Password123!`**.

| Email | Role | Can |
|---|---|---|
| `admin@ims.ph` | Administrator | everything (still cannot approve their own document — except own stock adjustments, if enabled in Settings for single-admin setups) |
| `pm@ims.ph` | Project Manager | approve POs / MRs / adjustments |
| `procurement@ims.ph` | Procurement Officer | create POs, manage suppliers (cannot approve own PO) |
| `bodega@ims.ph` | Warehouseman | receive, issue, transfer, man the POS (no costs, no approvals) |
| `engineer@ims.ph` | Site Engineer | raise requisitions, confirm deliveries |
| `accountant@ims.ph` | Accountant | costs, VAT/EWT, audit, void sales (no stock movement) |
| `auditor@ims.ph` | Auditor | read-only + audit log |
| `viewer@ims.ph` | Viewer | dashboards only |

These eight are the **built-in** roles, seeded into the `roles` table. An
administrator can retune any of them (except Administrator, which is locked to
full access) and create **custom roles** under **Roles & permissions** — ticking
any subset of the fixed permission catalogue. Permissions resolve live on every
request, so editing a role takes effect without re-login. Permissions themselves
are code-bound (each guards a real endpoint) and cannot be invented at runtime.

---

## Architecture

```
src/
├── app/
│   ├── (app)/            # authed shell (layout guards + sidebar)
│   ├── api/              # route handlers (validate → authorize → service)
│   └── login/            # public
├── components/
│   ├── charts/           # inline-SVG bar + ranked bars (no chart library)
│   └── ui/               # monochrome design system
├── db/
│   ├── schema.ts         # Drizzle schema (28 tables)
│   ├── seed.ts           # PH materials catalog + demo users
│   └── reprice.ts        # per-category markup rate card (repeatable)
├── lib/
│   ├── auth/             # bcrypt, opaque DB sessions, DAL guards
│   ├── services/         # domain logic: procurement, receiving, requisition,
│   │                     #   stock, sales, salesReport, stockImport, ledger
│   │                     #   (the stock engine), costing
│   ├── ph.ts             # VAT / EWT / TIN / units / money (centavo-safe)
│   ├── rbac.ts           # permission matrix + separation-of-duties rules
│   └── api.ts            # response envelope + zod validation wrapper
└── proxy.ts              # Next 16 request gate (renamed from middleware)
```

### Design decisions

- **Money is never a float.** All PHP amounts are integer centavos internally
  (`src/lib/ph.ts`) and stored as `numeric(14,2)`.
- **The stock ledger is append-only.** `stock_movements` is never updated or
  deleted; reversals are new rows. `applyMovement` takes a `FOR UPDATE` lock on
  the stock row, so concurrent issues cannot oversell — and it returns the cost
  it posted at, so callers never re-read it and race.
- **Costing is weighted moving-average** (PAS 2 / PFRS): only inbound movements
  move the average; outbound is costed at the prevailing average. A positive
  adjustment is cost-neutral (found stock is valued at the current average) —
  except an import, which must carry a cost, or brand-new stock books at ₱0.
- **Document numbers are gapless** per BIR expectation, allocated with
  `UPDATE ... RETURNING` inside the same transaction as the document insert.
- **Tax classification is never client-supplied.** A sale's VAT class is read
  from the item master; the VAT *rate* is a company setting, never a switch at
  the till. Dropping VAT on VATable goods is under-remittance to the BIR.
- **Two independent gates** protect every mutation: role permission
  (`hasPermission`, resolved from the role's live permission set) and
  per-document separation of duties (`assertCan*`) — and ADMIN is _not_ exempt
  from the latter (bar the opt-in single-admin adjustment self-approval).
- **The database is the last line of defence.** CHECK constraints reject
  negative money, zero quantities, and a cash tender below the total, so a bug
  above the DB cannot write a corrupt invoice.

---

## Document flows

```
Procurement:  PO (procurement) → approve (PM) → GRN (warehouseman) → stock ↑
Requisition:  MR (engineer) → approve+reserve (PM) → issue (warehouseman) → stock ↓
Transfer:     dispatch (out) → in-transit → receive (in)   # warehouse ↔ bodega
Adjustment:   count/damage/pilferage → approve by another user → stock ±
Import:       CSV → draft adjustment → approve by another user → stock ↑
Sale (POS):   ring up → post SI → stock ↓        (void → cancel + restore stock)
```

Each arrow is a role boundary. The service layer refuses to let one person cross
two of them on the same document — including the person who imports stock, who
cannot approve their own import.

---

## Stock import

`Stock on hand → Import stock`. Download the CSV template, fill it, upload.

- Rows for unknown SKUs **create the item**; rows for existing SKUs top up stock.
- It raises a **draft adjustment** — it never writes stock directly. A second
  person approves it. Conjuring inventory from a spreadsheet is exactly what the
  approval control exists to prevent.
- **All-or-nothing**: one bad row rejects the whole file, with per-row errors
  quoting the spreadsheet line number. A half-applied import is worse than a
  rejected one.

CSV rather than XLSX on purpose: real `.xlsx` needs a parser dependency for no
extra capability, and Excel opens and saves CSV natively.

---

## Photos (Cloudflare R2)

Delivery-proof photos attach to a goods receipt; items carry material photos.
Files live in **Cloudflare R2** (S3-compatible).

- Upload is **proxied through the API** (`POST /api/attachments`, multipart) — no
  bucket CORS needed, and every upload is permission-checked first.
- Images are **private**: they stream back through an auth-gated route
  (`GET /api/attachments/[id]/raw`), so photos follow the same RBAC as the rest
  of the system. There is no public bucket URL.
- Without the `R2_*` vars the upload button reports storage-not-configured
  instead of crashing.

Images only (png/jpg/webp/gif), 10 MB max.

---

## Environment

See `.env.example`. The full required set is five variables:

```
DATABASE_URL            # Neon: use the POOLED (-pooler) host, keep sslmode=require
R2_ENDPOINT
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Don't set `NODE_ENV` by hand — the build and host set it. There is no
`SESSION_SECRET`: sessions are opaque random tokens whose SHA-256 hash is stored,
so there is nothing to sign with.

On **Vercel**, `.env.production` is not read — paste these into
Project → Settings → Environment Variables. Deploys build from pushes to
`main`; run `npm run db:migrate` against the production database before (or
with) the deploy so schema and code stay in step.

---

## Testing

```bash
npm test          # unit: tax, units, RBAC, costing, movement direction
npm run test:e2e  # e2e: login, RBAC, PO→GRN→stock, MR→issue (needs a seeded DB)
```

Unit tests are pure and need no database. E2E drives the real API with the
correct role for each step, proving both the happy path (stock actually moves)
and that a user cannot approve their own document.

CI (`.github/workflows/ci.yml`) runs typecheck, lint and unit tests on Node 22.
E2E is not in CI: it needs a live Postgres, a seeded DB, R2 credentials and a
browser.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:generate` | Generate a migration from `schema.ts` |
| `npm run db:seed` | Seed catalog + users (idempotent) |
| `npm run db:reprice` | Set selling prices from cost via a per-category rate card (`-- --dry` to preview) |
| `npm run db:reset` | Drop, recreate, migrate, seed |
| `npm test` / `npm run test:e2e` | Unit / E2E |

---

## Compliance notes & scope

- Tax rates and document rules reflect BIR issuances through mid-2026 (VAT 12%,
  EWT 1%/2%, EOPT invoice-primary, 5-year record retention). Confirm current ATC
  codes and TWA status with your accountant before filing.
- The POS issues a compliant **Sales Invoice** with output VAT, but it is **not a
  BIR-accredited POS machine**: there are no X/Z readings, no e-journal and no
  accumulated grand total. Machine accreditation is a separate undertaking.
- Senior-citizen / PWD statutory discounts are **not** implemented.
- The **Data Privacy Act (RA 10173)** applies to the employee, supplier and
  customer PII stored here: access is role-scoped and every action is audited.
  Appoint a DPO and complete NPC registration if your headcount or data volume
  requires it.

Not in scope: payroll, accounting GL, DOLE/OSH safety programs, PCAB licensing
workflow (the firm's PCAB number is a settings field only), and IP-based login
rate limiting (per-account lockout exists; a distributed credential-stuffing
throttle does not).
