# BuildStock — Philippine Construction Inventory Management

A web-based inventory management system for construction firms in the
Philippines. Multi-project, multi-warehouse stock control with BIR-aware
tax handling, role-based access control, and separation-of-duties baked into
every document flow.

Built with **Next.js 16** (App Router, React 19), **Drizzle ORM** on
**PostgreSQL 18** (Docker), **Tailwind v4**, and a strictly black-and-white UI.

---

## Why this exists

Generic inventory apps miss what a PH construction firm actually needs:

- **BIR compliance** — 12% VAT with per-line VATable / zero-rated / exempt
  classification, 1% (goods) / 2% (services) expanded withholding tax for Top
  Withholding Agents, TIN capture, and post-EOPT (RA 11976) document rules
  where the **Sales Invoice** is the primary tax document and the Delivery
  Receipt is supplementary.
- **Anti-pilferage** — segregation of duties (requester ≠ approver ≠ receiver
  ≠ issuer), an append-only stock ledger, and an immutable audit log.
- **Site reality** — central warehouse vs jobsite _bodega_, stock transfers,
  weather-sensitive buffer stock for the June–November typhoon season, and PH
  units (cement bags, rebar lengths, board feet, cu.m).

The domain rules below were distilled from sourced BIR/PH research (kept locally
in `docs/PH-RESEARCH.md`, not committed).

---

## Quick start

Prerequisites: Node 20+, Docker Desktop.

```bash
# 1. Install
npm install

# 2. Environment — copy the example and generate a session secret
cp .env.example .env
node -e "console.log('SESSION_SECRET='+require('crypto').randomBytes(32).toString('base64'))"
#   paste the line into .env

# 3. Database — Postgres 18 in Docker on port 5433
docker compose up -d

# 4. Schema + seed (41-item PH catalog, 8 role accounts)
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev            # http://localhost:3000
```

### Demo accounts

Every account uses the password **`Password123!`**.

| Email | Role | Can |
|---|---|---|
| `admin@ims.ph` | Administrator | everything |
| `pm@ims.ph` | Project Manager | approve POs / MRs / adjustments |
| `procurement@ims.ph` | Procurement Officer | create POs, manage suppliers (cannot approve own PO) |
| `bodega@ims.ph` | Warehouseman | receive, issue, transfer (no costs, no approvals) |
| `engineer@ims.ph` | Site Engineer | raise requisitions, confirm deliveries |
| `accountant@ims.ph` | Accountant | costs, VAT/EWT, audit (no stock movement) |
| `auditor@ims.ph` | Auditor | read-only + audit log |
| `viewer@ims.ph` | Viewer | dashboards only |

---

## Architecture

```
src/
├── app/
│   ├── (app)/            # authed dashboard (layout guards + sidebar)
│   ├── api/              # REST route handlers (validate → authorize → service)
│   └── login/            # public
├── db/
│   ├── schema.ts         # Drizzle schema (24 tables)
│   └── seed.ts           # PH materials catalog + demo users
├── lib/
│   ├── auth/             # bcrypt, opaque DB sessions, DAL guards
│   ├── services/         # domain logic: procurement, receiving, requisition,
│   │                     #   stock, ledger (the stock engine), costing
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
  the stock row so concurrent issues cannot oversell.
- **Costing is weighted moving-average** (PAS 2 / PFRS): only inbound movements
  move the average; issues are costed at the prevailing average.
- **Document numbers are gapless** per BIR expectation, allocated with
  `UPDATE ... RETURNING` inside the same transaction as the document insert.
- **Two independent gates** protect every mutation: role permission
  (`hasPermission`) and per-document separation of duties (`assertCan*`) — and
  ADMIN is _not_ exempt from the latter.

---

## Document flows

```
Procurement:  PO (procurement) → approve (PM) → GRN (warehouseman) → stock ↑
Requisition:  MR (engineer) → approve+reserve (PM) → issue (warehouseman) → stock ↓
Transfer:     dispatch (out) → in-transit → receive (in)   # warehouse ↔ bodega
Adjustment:   count/damage/pilferage → approve by another user → stock ±
```

Each arrow is a role boundary. The service layer refuses to let one person
cross two of them on the same document.

---

## Photos (Cloudflare R2)

Delivery-proof photos attach to a goods receipt; the `item` entity is wired for
material photos too. Files live in **Cloudflare R2** (S3-compatible).

- Upload is **proxied through the API** (`POST /api/attachments`, multipart) —
  no bucket CORS needed, and every upload is permission-checked first
  (`grn:create` for delivery photos).
- Images are **private**: they stream back through an auth-gated route
  (`GET /api/attachments/[id]/raw`), not a public URL, so photos follow the
  same RBAC as the rest of the system.
- Configure the `R2_*` vars in `.env` (see `.env.example`). Without them, the
  upload button reports storage-not-configured instead of crashing.

Only images are accepted (png/jpg/webp/gif), 10 MB max.

## Testing

```bash
npm test          # unit: tax, units, RBAC, costing, separation of duties
npm run test:e2e  # e2e: login, RBAC, PO→GRN→stock, MR→issue (needs DB seeded + dev server)
```

Unit tests are pure and need no database. E2E tests drive the real API with the
correct role for each step, proving both the happy path (stock actually moves)
and that a user cannot approve their own document.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Seed catalog + users (idempotent) |
| `npm run db:reset` | Drop, recreate, migrate, seed |
| `npm test` / `npm run test:e2e` | Unit / E2E |

---

## Compliance notes & scope

- Tax rates and document rules reflect BIR issuances through mid-2026 (VAT 12%,
  EWT 1%/2%, EOPT invoice-primary, 5-year record retention). Confirm current
  ATC codes and TWA status with your accountant before filing.
- The **Data Privacy Act (RA 10173)** applies to the employee and supplier PII
  stored here: access is role-scoped and every action is audited. Appoint a DPO
  and complete NPC registration if your headcount or data volume requires it.
- e-invoicing (EIS) is not yet mandatory for SMEs; invoice data is stored
  structured so onboarding later is cheap.

Not in scope: payroll, accounting GL, DOLE/OSH safety programs, PCAB licensing
workflow (the firm's PCAB number is a settings field only).
