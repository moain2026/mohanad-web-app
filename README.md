# Grocery System (نظام إدارة البقالة)

[![Node](https://img.shields.io/badge/node-%3E%3D20.10-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.9-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/lint-Biome%201.9-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev/)
[![Tests](https://img.shields.io/badge/tests-231%20passing-43853d.svg)](#testing)
[![Phases](https://img.shields.io/badge/phases-3%2F10%20done-orange.svg)](#current-status-truthful)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#license)

> نظام إدارة بقالة أونلاين متكامل (PWA) — عربي بالكامل (RTL)
>
> Stack: **React + TS + Vite + Ionic + Tailwind** | **NestJS + TypeScript** | **Prisma + PostgreSQL**
>
> Lint/format: **Biome** (replaces ESLint + Prettier).

---

## ⚠️ Read this first (Agent / Human Onboarding)

If you are an **AI agent or human** picking up this project, **read these files in order before writing any code**:

1. [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md) — onboarding guide for the next session (start here).
2. [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) — granular phase-by-phase reality (what is done, what is missing, what is broken, what is partial).
3. [`docs/12-agent-memory.md`](./docs/12-agent-memory.md) — locked product/architecture decisions that must NOT be changed without explicit user approval.
4. [`knowledge-base/`](./knowledge-base/) — repository audit folder (11 markdown files, ≈1,600 lines), generated 2026-05-02.

These four sources are the **single source of truth** for project state. The rest of `docs/` (00–13) reflects the **target design**, not necessarily the current implementation.

---

## Current Status (truthful)

> **Last updated**: 2026-05-03 (after merge of PR #6)
> **Branch**: `genspark_ai_developer` is the integration branch. Each phase merges via its own PR.

| Phase | Description | Status | Tests | Notes |
|------:|-------------|:------:|:-----:|-------|
| 0     | Documentation (`docs/00..13`) | ✅ done | — | Stable |
| 1     | Foundation (monorepo, schema, shells, design system, PWA scaffolding) | ✅ done | included below | — |
| 2     | Auth + RBAC (login, refresh, lockout, 19 modules / 181 permissions, admin UI for users + roles + account) | ✅ done | shared 69 + api 70 | — |
| **3** | **Customers + Debts** (backend + frontend + notifications UI + WhatsApp deep links) | ✅ **done** | api 70 + web 92 | merged in PR #6 (2026-05-03) |
| 4     | Suppliers + Purchases (cash + credit + atomic transactions) | ❌ **not started** | 0 | next branch: `phase4_suppliers_purchases` |
| 5     | Expenses + Daily Income | ❌ **not started** | 0 | depends on Phase 4 (supplier-payment expense type) |
| 6     | Sales (3 modes — detailed, quick, cash/credit) | ❌ **not started** | 0 | depends on Phase 3 (customer transactions) |
| 7     | Reports (11 types) | ❌ **not started** | 0 | depends on Phases 4, 5, 6 |
| 8     | Notifications + WhatsApp templates + cron + behavior analysis | ❌ **not started** | 0 | basic notifications shipped in Phase 3 |
| 9     | Inventory (optional module) | ❌ **not started** | 0 | gated behind a settings toggle |
| 10    | Polish + PWA + Railway deploy + E2E tests | ❌ **not started** | 0 | Lighthouse already at 81/92/96/91 from Phase 1 |

**Total tests passing**: **231 / 231** (shared 69 + api 70 + web 92).
**Phases shipped**: **3 of 10** (Foundation, Auth+RBAC, Customers+Debts).

📄 Granular per-module reality lives in [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md).

---

## Sandbox-environment limitations (REAL, not theoretical)

The `genspark.ai` sandbox in which most agent work happens has the following hard limits that have shaped (and will keep shaping) the workflow:

| Limit | Impact | Workaround |
|-------|--------|------------|
| ❌ No PostgreSQL service available | Cannot run `prisma migrate dev`, cannot start the API end-to-end, no live `curl` against `/customers`, no live screenshots, no E2E flows. | Tests use **mocked Prisma** (Jest/Vitest); migrations are written but applied later on Railway in Phase 10. |
| ⏱ `pnpm build` (full monorepo) hits the 240 s `Bash` timeout | Cannot produce a production bundle from the sandbox. | Rely on `pnpm typecheck` + per-package `pnpm --filter @grocery/shared build`; the production build runs on Railway. |
| ❌ No headless browser ready for Playwright | Cannot run E2E flows or take screenshots. | Document expected screenshots; defer real captures to Phase 10 once deployed. |
| 📦 Heavy dev installs (Ionic, framer-motion, lucide) make `pnpm install` slow (≈ 23 s) and recursive `typecheck` requires `pnpm --filter @grocery/shared build` first (so its `dist/` exists). | Easy to forget on a clean clone. | Documented in [`DEVELOPMENT.md`](./DEVELOPMENT.md) §2 and [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md). |

**A new agent must verify these constraints before estimating timelines.** The cost of these limits is real: a phase that needs a Prisma migration cannot be merged from the sandbox alone — the migration SQL is hand-written, committed, and applied on Railway during Phase 10.

---

## Architecture (one-page)

```
                    ┌──────────────────────────────────────────────┐
                    │             apps/web  (React PWA)            │
                    │  Vite · TS · React 18 · Ionic 8 · RR v5      │
                    │  Tailwind RTL · Zustand · TanStack Query     │
                    │  Idempotency-Key auto-injected (lib/http)    │
                    └──────────────────────┬───────────────────────┘
                                           │ axios · /api/v1
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │            apps/api  (NestJS 10)             │
                    │  ResponseFormat · AllExceptions · Throttler  │
                    │  RequestId mw · Idempotency mw · JWT guard   │
                    │  PermissionsGuard · ZodValidationPipe        │
                    │  Modules: Health · Auth · Users · Roles ·    │
                    │           Permissions · Customers ·          │
                    │           CustomerTransactions · Notifications │
                    └──────────────────────┬───────────────────────┘
                                           │ Prisma 5 · Decimal(14,2)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │   PostgreSQL (Railway in prod, mocked here)  │
                    │   14 models · 2 migrations applied:          │
                    │   • init_phase2_auth                         │
                    │   • p3_customers_notifications               │
                    └──────────────────────────────────────────────┘

   packages/shared (workspace:*)   →   types · zod schemas · 181 permissions · utils
```

See [`docs/02-architecture.md`](./docs/02-architecture.md) for the full diagram.

---

## Repository layout

```
grocery-system/
├── apps/
│   ├── api/                 NestJS backend
│   │   └── src/modules/     auth · users · roles · permissions ·
│   │                         customers · notifications · health
│   └── web/                 React + Ionic + Vite PWA
│       └── src/
│           ├── components/  ui · layout · dashboard · permissions ·
│           │                 customers · notifications
│           ├── pages/       Login · Dashboard · admin/* · customers/* ·
│           │                 notifications/*
│           ├── lib/         http · api · api/{customers,notifications} ·
│           │                 whatsapp · cn · queryClient
│           └── stores/      authStore (zustand)
├── packages/
│   └── shared/              types · schemas · constants (PERMISSIONS) · utils
├── prisma/
│   ├── schema.prisma        14 models (Foundation 8 + Phase-2 RT/Idempotency
│   │                         + Phase-3 Customer/Transaction/Reminder/Notification)
│   ├── migrations/          2 migrations
│   ├── seed.ts              6 roles · 181 permissions · owner user
│   └── seed-test-users.ts   per-role smoke users
├── docs/                    🟢 read these:
│   ├── AGENT_HANDOFF.md     ⭐ start here when picking up the project
│   ├── PROJECT_STATUS.md    ⭐ truthful per-phase status
│   ├── 12-agent-memory.md   ⭐ locked decisions
│   ├── 00..13-*.md          design docs (target spec, not impl reality)
│   ├── recovery-report.md   Phase 1 + Phase 2 recovery
│   ├── phase2/              manual tests · curl outputs · screenshots
│   └── legacy/              archived schemas
├── knowledge-base/          ⭐ audit folder (2026-05-02, 11 files)
├── scripts/                 lighthouse + screenshot automation (Puppeteer)
├── biome.json               root (Q5)
├── tsconfig.base.json       root (Q5)
├── .nvmrc                   20
├── DEVELOPMENT.md           daily reference
└── README.md                you are here
```

---

## Requirements

- **Node.js** ≥ 20.10.0 (`.nvmrc` pins 20)
- **pnpm** 9.15.9 (`packageManager` field in `package.json`; install via `corepack`)
- **PostgreSQL** ≥ 14 (local for dev; Railway for prod) — **not required to run tests**

---

## Quick start

```bash
# 1. Node + pnpm
nvm use                                         # → 20
corepack enable
corepack prepare pnpm@9.15.9 --activate

# 2. Install
pnpm install                                    # ≈ 23 s

# 3. Generate Prisma client (no DB required)
pnpm db:generate

# 4. Build the shared package (REQUIRED before recursive typecheck)
pnpm --filter @grocery/shared build

# 5. Quality gates
pnpm lint                                       # Biome
pnpm typecheck                                  # tsc --noEmit (all 3 packages)
pnpm test                                       # Vitest + Jest → 231 tests

# 6. Database (when PostgreSQL is available)
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env
pnpm db:migrate                                 # apply 2 migrations
pnpm db:seed                                    # 6 roles · 181 permissions · owner

# 7. Dev servers
pnpm dev                                        # web :5173 + api :3001 in parallel
```

> **Sandbox warning**: `pnpm build` for the full monorepo exceeds the 240 s Bash timeout in the genspark sandbox. Use `pnpm --filter @grocery/<pkg> build` per package, or build on Railway / a real workstation.

---

## Daily commands

| Command           | Description                                                     |
|-------------------|-----------------------------------------------------------------|
| `pnpm dev`        | Run web (Vite :5173) + api (Nest :3001) in parallel            |
| `pnpm dev:api`    | API only                                                        |
| `pnpm dev:web`    | Web only                                                        |
| `pnpm build`      | Production build (slow — see sandbox warning above)             |
| `pnpm lint`       | Biome check (no auto-fix)                                       |
| `pnpm lint:fix`   | Biome check `--write` (safe fixes)                              |
| `pnpm format`     | Biome format `--write`                                          |
| `pnpm typecheck`  | `tsc --noEmit` in every package                                 |
| `pnpm test`       | Vitest (web/shared) + Jest (api), recursive                     |
| `pnpm db:generate`| Regenerate the Prisma client                                    |
| `pnpm db:migrate` | `prisma migrate dev` (requires DATABASE_URL)                    |
| `pnpm db:seed`    | Run `prisma/seed.ts`                                            |
| `pnpm db:studio`  | Open Prisma Studio                                              |
| `pnpm lh`         | Lighthouse audit (writes JSON + screenshots) — requires built web |

---

## Service URLs (local dev)

| Service                 | URL                                       |
|-------------------------|-------------------------------------------|
| Web (Vite)              | http://localhost:5173                     |
| API base                | http://localhost:3001/api/v1              |
| Health                  | http://localhost:3001/api/v1/health       |
| Scalar API reference UI | http://localhost:3001/api/v1/docs         |
| OpenAPI JSON            | http://localhost:3001/api/v1/docs-json    |

---

## Roadmap (truthful)

This is what **actually remains** to ship a production-ready system. Each phase is a separate PR.

### Phase 4 — Suppliers + Purchases  ▶ **next**
- Prisma migration `p4_suppliers_purchases` adding `Supplier`, `SupplierTransaction`, `Purchase`, `PurchaseItem` models.
- Backend: SuppliersService, SupplierTransactionsService, PurchasesService — all wrapped in `prisma.$transaction` with `SELECT FOR UPDATE` semantics.
- **Cash purchase**: NO supplier balance change (records the purchase only).
- **Credit purchase**: atomic — creates `Purchase` row + `SupplierTransaction(CREDIT_PURCHASE)` row + updates `Supplier.currentBalance`.
- Frontend: `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/purchases`, `/purchases/new` (3-step wizard).
- ≥ 30 new tests covering the cash-vs-credit invariants and the cancel-reverses-balance flow.
- Commit: `feat(p4): suppliers + supplier-transactions + purchases (cash + credit)`.

### Phase 5 — Expenses + Daily Income
- Prisma: `ExpenseCategory` (9 system categories seeded), `Expense` (types: NORMAL, SUPPLIER_PAYMENT, CASH_PURCHASE_LINK), `DailyIncome` (one row per day per store).
- Critical rule: `SUPPLIER_PAYMENT` updates supplier balance; `CASH_PURCHASE_LINK` does NOT (it just references the purchase row from Phase 4).
- Frontend: `/expenses`, `/expenses/new`, `/daily-income`, `/daily-income/history`.

### Phase 6 — Sales (3 modes)
- Prisma: `Sale`, `SaleItem`.
- Modes:
  - **Quick sale**: total + customer + cash/credit; for credit, must respect customer credit limit and create a `CustomerTransaction(DEBT)` atomically.
  - **Detailed sale**: line items (requires Phase 9 if inventory is enabled; otherwise free-text items).
  - **Cash sale**: no customer linkage; records to `DailyIncome`.
- ≥ 25 tests covering balance impact, cancellation reversal, and credit-limit enforcement.

### Phase 7 — Reports (11 types)
- Server-side calculations only (UI never aggregates raw rows).
- Daily summary, P&L (accurate vs estimated), cash flow, customer debts ageing, supplier balances, top customers/items, etc.
- Permissions split into `view`, `print`, `export` per report.

### Phase 8 — Notifications advanced + WhatsApp templates + cron + behavior analysis
- `NotificationTemplate` model with `WHATSAPP_REMINDER`, `WHATSAPP_THANK_YOU`, `IN_APP_NOTIFICATION` types.
- `ScheduledJob` + `@nestjs/schedule` cron entries (daily reminders 9 AM; behavior analysis 11 PM; weekly idempotency cleanup; monthly notification archive).
- `CustomerBehaviorAlert` triggered when customer’s monthly spend drops > 50 %.
- Template editor at `/admin/templates` with live preview + variable autocomplete.

### Phase 9 — Inventory (optional)
- `Product` and `StockMovement` models, gated behind `inventory.enabled` setting.
- Detailed sale → automatic stock-out movement; detailed purchase → stock-in.
- Negative stock blocked unless `inventory.allow_negative_stock = true`.

### Phase 10 — Polish + PWA + Railway deploy + E2E
- Route-level `React.lazy` everywhere (already partially done).
- Vendor chunk splitting (framer / charts / ionic separate chunks; target initial < 300 KB gzip).
- Service Worker: CacheFirst static, NetworkOnly `/api/*`.
- App shortcuts in `manifest.webmanifest`.
- Playwright ≥ 30 E2E tests across 3 viewports.
- Railway deployment (API + web + Postgres), GitHub Actions CI.
- Final docs: USER_GUIDE.md, ADMIN_GUIDE.md, TROUBLESHOOTING.md, DEPLOYMENT.md, ARCHITECTURE.md.

📄 Full target design lives in [`docs/11-development-roadmap.md`](./docs/11-development-roadmap.md). Where the roadmap and current code disagree, **`docs/PROJECT_STATUS.md` wins**.

---

## Testing

```bash
pnpm --filter @grocery/shared test        # 69 tests · vitest
pnpm --filter @grocery/api test           # 70 tests · jest + ts-jest
pnpm --filter @grocery/web test -- --run  # 92 tests · vitest + RTL
```

Coverage on critical modules (Phase 2 baseline, still valid):

| Module                            | Statements | Branches | Functions |
|-----------------------------------|------------|----------|-----------|
| `auth.service`                    | 94 %       | 90 %     | 100 %     |
| `permissions.guard`               | 100 %      | 100 %    | 100 %     |
| `users.service`                   | ≈ 90 %     | 86 %     | —         |
| `roles.service`                   | ≈ 96 %     | 92 %     | —         |
| `idempotency.middleware`          | ≈ 92 %     | 88 %     | —         |

Phase-3 service-level coverage targets are documented in [`knowledge-base/04-backend-modules-status.md`](./knowledge-base/04-backend-modules-status.md).

---

## Documentation map

| File | Purpose | Authoritative? |
|------|---------|:--------------:|
| [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md) | Onboarding for the next AI / human session | ⭐ yes |
| [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) | Truthful per-phase / per-module status | ⭐ yes |
| [`docs/12-agent-memory.md`](./docs/12-agent-memory.md) | Locked product/architecture decisions | ⭐ yes |
| [`knowledge-base/`](./knowledge-base/) | 2026-05-02 audit folder | ⭐ yes |
| [`docs/recovery-report.md`](./docs/recovery-report.md) | Phase 1 + Phase 2 recovery PR write-up | reference |
| [`docs/00-project-overview.md`](./docs/00-project-overview.md) | Product vision | target spec |
| [`docs/01-requirements-analysis.md`](./docs/01-requirements-analysis.md) | Requirements catalogue | target spec |
| [`docs/02-architecture.md`](./docs/02-architecture.md) | Architecture diagrams | target spec |
| [`docs/03-database-design.md`](./docs/03-database-design.md) | Full target schema | target spec — **partially implemented** |
| [`docs/04-rbac-permissions.md`](./docs/04-rbac-permissions.md) | RBAC design | implemented |
| [`docs/05-ui-ux-guidelines.md`](./docs/05-ui-ux-guidelines.md) | Design system + RTL conventions | implemented |
| [`docs/06-modules.md`](./docs/06-modules.md) | Per-module spec | target spec |
| [`docs/07-api-plan.md`](./docs/07-api-plan.md) | API contract | partial |
| [`docs/08-reports.md`](./docs/08-reports.md) | Reports catalogue | target spec |
| [`docs/09-notifications.md`](./docs/09-notifications.md) | Notifications + WhatsApp | basic done, advanced pending Phase 8 |
| [`docs/10-security-and-audit.md`](./docs/10-security-and-audit.md) | Security model | implemented |
| [`docs/11-development-roadmap.md`](./docs/11-development-roadmap.md) | Original 10-phase plan | target plan |
| [`docs/13-pre-foundation-checklist.md`](./docs/13-pre-foundation-checklist.md) | Phase-1 launch checklist | historical |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Daily dev reference | implemented |

> **Rule of thumb**: when implementation and target docs (00–13) disagree, **the implementation + `PROJECT_STATUS.md` win**, and you must NOT silently change implementation to match `docs/`. Open a question with the user first.

---

## License

Private — proprietary.
