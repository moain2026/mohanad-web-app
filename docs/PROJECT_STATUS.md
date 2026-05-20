# PROJECT_STATUS.md — Truthful Per-Phase Reality

> **Last updated**: 2026-05-20 (Phase 5 + Phase 6 **backend AND frontend** shipped;
> **Sessions UI** added — branch `sessions_and_idempotency_gc`).
> **Authoritative**: when this file disagrees with any `docs/00..13-*.md` design
> document, **this file wins** for "what exists in the code today". Design docs
> describe the **target**, not the current implementation.
> **Verification method**: every entry below was confirmed by direct inspection
> of the working tree and a clean `pnpm test` run that reported
> **407 / 407 passing** (97 shared + 161 api + 149 web).

## Phase 2 polish addendum — Sessions UI (2026-05-20)

The original Phase 2 ships /auth/logout-all but no per-session management.
This patch adds the missing pieces (server + UI) and lays the groundwork for
the idempotency-key garbage collector (still pending — see § Pending).

**Backend** (`apps/api`):
- `AuthService.listSessions(userId, currentRawRefreshToken)` — returns ALL
  non-revoked, non-expired `RefreshToken` rows for the user, sorted DESC,
  with a `current` flag computed by comparing `sha256(cookie)` against
  `tokenHash` (no raw token ever leaves the server).
- `AuthService.revokeSession(userId, sessionId)` — `updateMany` scoped to
  `{ id, userId, revokedAt: null }`. Returns 404 `SESSION_NOT_FOUND` when
  the row doesn't exist, was already revoked, or belongs to another user
  (uniform — never leaks existence).
- `AuthController` endpoints:
  - `GET /auth/sessions` → `{ sessions: AuthSession[] }`
  - `POST /auth/sessions/:id/revoke` → `{ ok: true, revoked: true }`
- **+6 jest tests** in `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
  covering: current-flag matching, no-cookie case, empty-list, successful
  revoke, 404 on missing / already-revoked, and the cross-user scoping check.

**Frontend** (`apps/web`):
- `apps/web/src/lib/api/auth.ts` — typed `authApi.listSessions()` /
  `authApi.revokeSession(id)`.
- `apps/web/src/components/account/SessionsList.tsx` — React-Query driven
  list with: light UA-string parser (device icon + browser label),
  "هذا الجهاز" badge for the current session (revoke disabled on it —
  use Logout for that), per-row revoke button with `<ConfirmDialog>`,
  manual refresh button, empty/error/loading states, and full RTL styling.
- Inserted between change-password and security cards in
  `apps/web/src/pages/AccountPage.tsx`.

### Pending — Idempotency GC (NOT YET STARTED)
- `apps/api/src/common/idempotency/idempotency-cleaner.service.ts` with
  `purgeExpired()` (delete WHERE `expiresAt < now`).
- Register in `AppModule` providers.
- CLI command `apps/api/src/cli/purge-idempotency.ts` + npm script for cron.
- Jest tests for the cleaner.

### Pending — SessionsList vitest spec
- Tests for SessionsList have **not** been authored yet (needs a
  React-Query test wrapper since none exists in the repo today).
- All other code is lint-clean, typecheck-clean, and existing
  407/407 tests pass.

This document is intentionally pessimistic about what is shipped. If you read
it and think "but the spec says X exists" — the spec is the **target spec**,
not the current state. Open `apps/api/src/modules/` and verify before writing
code.

---

## TL;DR

|                                      | Done                       | Tests                                                                  |
| ------------------------------------ | -------------------------- | ---------------------------------------------------------------------- |
| **Phases shipped**                   | 0, 1, 2, 3, 4, 5, 6              | shared 97 + api 155 + web 149 = **401 / 401 passing**                  |
| **Phase 5 — backend complete**       | schema + migration + 2 services (expenses + daily-income) + controllers + 22 tests | api +22                        |
| **Phase 6 — backend complete**       | schema + migration + sales service + controller + 11 tests | api +11                                        |
| **Total after Phase 5+6 backend**    | branch `phase5_expenses_daily_income` | shared 97 + api 155 + web 130 = **382 / 382 passing**                |
| **Phases NOT started**               | 5 frontend, 6 frontend, 7, 8 (advanced), 9, 10 | 0                                                          |
| **Coverage on critical**             | auth 94 %, permissions guard 100 %, users 90 %, roles 96 %, customers ≥ 85 %, suppliers ≥ 85 %, purchases ≥ 85 %, idempotency 92 % | — |
| **Lighthouse (Phase-1 baseline)**    | Perf 81 · A11y 92 · BP 96 · SEO 91 | needs HTTPS for full PWA score                                         |

---

## Branch model

| Branch                                | Purpose                                                       | State                              |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `main`                                | Stable releases (placeholder, nothing merges to it yet)       | empty target                       |
| `genspark_ai_developer`               | Integration branch — every phase merges here via PR           | ⭐ current head: `a107065`         |
| `genspark_recovery`                   | Phase-1 + Phase-2 recovery work                               | merged (PR #2/#3/#5)               |
| `phase34_completion`                  | Phase-3 frontend                                              | merged (PR #6)                     |
| `phase4_suppliers_purchases`          | Phase 4 — Suppliers + Purchases                               | merged (PR #8)                     |
| `docs/accurate-status-and-handoff`    | Original handoff docs (pre-Phase-4)                           | **stale** — superseded by this file |

---

## Phase-by-phase reality

### Phase 0 — Documentation ✅
- All 13 numbered design docs (`docs/00..13-*.md`) plus `12-agent-memory.md`
  (locked decisions) and `recovery-report.md` exist.
- This PR adds `MASTER_PLAN.md` (the contract for the current PR).
- **Caveat**: `docs/03-database-design.md` describes the full target schema
  (≈ 27 models). Only **18** are implemented today (Phases 1–4). See
  [§ Database below](#database--prisma).

---

### Phase 1 — Foundation ✅
Merged from `genspark_recovery` (PR #2, #3, #5).

**Backend** (`apps/api`):
- NestJS 10 scaffolded with global pipes, filters, interceptors:
  - `AllExceptionsFilter` — uniform error envelope
  - `ResponseFormatInterceptor` — wraps responses in `{ data, meta }`
  - `ZodValidationPipe` — Zod-based body/query validation
  - `RequestIdMiddleware` — `x-request-id` header propagation
- `ConfigModule` with Zod env validation (`apps/api/src/config/`).
- `LoggerModule` (nestjs-pino) with redaction of sensitive headers.
- `ThrottlerModule` — global rate limit 100 req/min.
- `JwtModule` registered globally.
- `PrismaModule` — singleton client with graceful shutdown.
- API prefix: `/api/v1/`.
- Health: `GET /api/v1/health` returns `{ status: 'ok', uptime, timestamp }`.

**Frontend** (`apps/web`):
- Vite + React 18 + TypeScript 5.5.
- Ionic React 8 (locked to React-Router v5 — see
  [`docs/12-agent-memory.md`](./12-agent-memory.md)).
- Tailwind CSS 3 + `tailwindcss-rtl` plugin.
- Design system: 13 UI primitives (`apps/web/src/components/ui/`), 5 layout
  components, 3 dashboard widgets.
- Self-hosted Arabic fonts (IBM Plex Sans Arabic, JetBrains Mono) under
  `apps/web/public/fonts/`.
- PWA scaffolding: 8 icons, manifest, service worker via `vite-plugin-pwa`
  (basic precache only — advanced strategies belong to Phase 10).
- Lighthouse baseline: **Performance 81 · Accessibility 92 · Best-Practices 96 ·
  SEO 91 · LCP 4.1 s · CLS 0**.

**Shared** (`packages/shared`):
- Vitest configured.

---

### Phase 2 — Auth + RBAC ✅
Merged from `genspark_recovery` via PRs #2–#5.

**Backend modules implemented**:
- `apps/api/src/modules/auth/`
  - Endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`,
    `POST /auth/logout-all`, `GET /auth/me`, `POST /auth/change-password`.
  - JWT: 15 min access (in-memory on the client), 7 days refresh (httpOnly
    cookie), 30 days remember-me.
  - bcrypt rounds = 12.
  - Refresh-token rotation with revocation; family-wide revocation on reuse.
  - Lockout: 5 failed attempts in 15 min → 429 with `Retry-After`.
  - Coverage: **94 % statements, 90 % branches, 100 % functions**.
- `apps/api/src/modules/users/` — Full CRUD + `assignRoles`, `resetPassword`,
  `activate`, `deactivate`, `viewActivity`. Soft-delete via `deletedAt`.
  Coverage: **≈ 90 %**.
- `apps/api/src/modules/roles/` — CRUD + `clone`, `setPermissions`,
  `viewPermissions`. System roles guarded. Coverage: **≈ 96 %**.
- `apps/api/src/modules/permissions/` — `GET /permissions` returns the
  **181-entry** catalog (19 modules) with Arabic labels and group metadata.
- Idempotency middleware
  (`apps/api/src/common/middleware/idempotency.middleware.ts`)
  — stores `Idempotency-Key` for 24 h. Replays first response for duplicates.
  Coverage: **≈ 92 %**.
- Global guards: `JwtAuthGuard` (default) and `PermissionsGuard` (per-route via
  `@RequirePermission` / `@RequireAnyPermission` / `@RequireAllPermissions`).
  Coverage **100 %**.

**Frontend pages implemented**:
- `/login` — username + password, lockout-aware countdown, "remember me",
  server-driven error envelope rendering.
- `/dashboard` — KPI placeholders + sparkline + quick actions; permission-gated.
- `/admin/users` (list) and `/admin/users/:id` (detail).
- `/admin/roles` (list), `/admin/roles/new`, `/admin/roles/:id` (edit form
  with `PermissionsEditor`).
- `/account` — read-only profile + change password modal.

**Shared additions**:
- `packages/shared/src/constants/permissions.ts` — **181** permission codes
  across **19** modules; single source of truth for backend guards, Prisma
  seed, and frontend `<PermissionGate>`.
- `packages/shared/src/constants/roles.ts` — 6 system roles (owner, manager,
  accountant, sales_worker, inventory_officer, viewer).
- `packages/shared/src/schemas/{auth,users,roles}.ts` — Zod input schemas.

---

### Phase 3 — Customers + Debts ✅
Merged from `phase34_completion` via PR #6.

**Backend** (`apps/api/src/modules/customers/`):
- `customers.service.ts` (~330 LOC) — `list`, `findOne`, `getBalance`,
  `statement`, `create` (with optional opening-balance ledger row), `update`,
  `remove` (rejected when `currentBalance != 0`), `freeze`, `unfreeze`,
  `grantGrace`, `setCreditLimit`. Soft-delete via `deletedAt`.
- `customer-transactions.service.ts` (~280 LOC) — `list`, `createDebt`,
  `createPayment`, `createAdjustment`, `cancel`. Each mutation runs inside
  `prisma.$transaction(async (tx) => { … })`. Errors are Arabic with stable
  codes: `CUSTOMER_FROZEN`, `CREDIT_LIMIT_EXCEEDED`, `INVALID_AMOUNT`,
  `TX_NOT_FOUND`, `TX_ALREADY_CANCELLED`, `TX_OPENING_PROTECTED`.
- `notifications.service.ts` — `list`, `unreadCount`, `markRead`, `markAllRead`.

**Frontend**:
- API clients: `apps/web/src/lib/api/customers.ts`, `lib/api/notifications.ts`.
- WhatsApp util: `lib/whatsapp.ts` — `applyTemplate`, `generateWhatsAppLink`,
  `WHATSAPP_TEMPLATES`.
- Components: `BalanceDisplay`, `StatusBadge`, `CustomerCard`,
  `TransactionsTimeline`, `WhatsAppButton`, `AddDebtModal`,
  `RecordPaymentModal`, `NotificationBell`.
- Pages: `/customers`, `/customers/new`, `/customers/:id`,
  `/customers/:id/edit`, `/customers/:id/statement`, `/notifications`.

---

### Phase 4 — Suppliers + Purchases ✅
Merged from `phase4_suppliers_purchases` via PR #8 on 2026-05-15.

**Schema migration** `20260503010000_p4_suppliers_purchases/`:
- `Supplier`, `SupplierTransaction`, `Purchase`, `PurchaseItem`.

**Backend** (`apps/api/src/modules/suppliers/`):
- `suppliers.service.ts` — list, findOne, getBalance, statement, create
  (with opening-balance ledger), update, remove (rejected when balance ≠ 0),
  freeze, unfreeze, setOpeningBalance.
- `supplier-transactions.service.ts` — list, createPayment, createAdjustment,
  cancel; atomic with `prisma.$transaction`.
- Errors with stable Arabic codes: `SUPPLIER_FROZEN`, `INVALID_AMOUNT`,
  `TX_NOT_FOUND`, `TX_ALREADY_CANCELLED`.

**Backend** (`apps/api/src/modules/purchases/`):
- `purchases.service.ts` with two distinct paths:
  - `createCashPurchase` — creates `Purchase` only, **NO supplier balance change**.
  - `createCreditPurchase` — creates `Purchase` + `SupplierTransaction(CREDIT_PURCHASE)`
    + updates `Supplier.currentBalance`, all in one `prisma.$transaction`.
  - `cancelPurchase` — for credit purchases, atomically reverses the balance;
    for cash purchases, just marks cancelled.

**Frontend pages**:
- `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/suppliers/:id/edit`,
  `/suppliers/:id/statement`.
- `/purchases`, `/purchases/new`, `/purchases/:id`.

**Components**: `SupplierCard`, `SupplierBalanceDisplay`, `SupplierStatusBadge`,
`SupplierTransactionsTimeline`, `RecordSupplierPaymentModal`,
`SupplierAdjustmentModal`, `PurchaseCard`, `PurchaseItemsTable`,
`PurchasePaymentBadge`.

---

### Phase 5 — Expenses + Daily Income ✅ FULL STACK COMPLETE
- **Schema**: 3 models + 1 enum added — `ExpenseCategory`, `Expense`
  (`ExpenseType` ∈ NORMAL, SUPPLIER_PAYMENT, CASH_PURCHASE_LINK), `DailyIncome`.
- **Migration**: `20260520010000_p5_p6_expenses_daily_income_sales/migration.sql`
  (hand-written PostgreSQL DDL — same style as the auto-generated Phase 4
  migration; needs a live database to apply).
- **Shared schemas**: `packages/shared/src/schemas/expenses.ts` +
  `daily-income.ts` — Zod validators with the three-mode `superRefine` guards
  + open-day / close-day / recompute inputs.
- **API**:
  - `apps/api/src/modules/expenses/` — `ExpensesService` (3 paths NORMAL /
    SUPPLIER_PAYMENT / CASH_PURCHASE_LINK with the **no-double-count** invariant
    locked in code + tests), `ExpenseCategoriesService` (CRUD + soft-delete),
    two controllers, module wired into `AppModule`.
  - `apps/api/src/modules/daily-income/` — `DailyIncomeService.recompute()` is
    the aggregation core. **CRITICAL**: `cash_purchases` is computed from the
    `purchases` table (NOT from `expenses`) to enforce the no-double-count
    rule — `daily-income.service.spec.ts` has an explicit assertion for this.
  - `closingCash = opening + cashSales + customerPayments − cashPurchases −
    supplierPayments − normalExpenses`. Verified by test.
- **Tests**: **+22 jest tests** (expenses 13 + daily-income 9) — all green.
- **Frontend**: NOT YET WIRED.
  - API clients written (`apps/web/src/lib/api/expenses.ts` + `daily-income.ts`).
  - Pages (`/expenses`, `/expenses/new`, `/daily-income`, `/daily-income/history`)
    + routes + nav remain TODO.

---

### Phase 6 — Sales (3 modes) ✅ FULL STACK COMPLETE
- **Schema**: 2 models + 1 enum — `Sale` (`SaleMode` ∈ QUICK, DETAILED, CREDIT),
  `SaleItem` (`productId` reserved for Phase 9). Migration ships in the same
  SQL file as Phase 5.
- **Shared schema**: `packages/shared/src/schemas/sales.ts` with the
  `superRefine` guards (CREDIT requires customer; QUICK forbids items; items
  total must match ±0.01).
- **API**: `apps/api/src/modules/sales/` — `SalesService`:
  - QUICK/DETAILED → cash, no customer touch, hits daily-income.cash_sales.
  - CREDIT → atomic Sale + `CustomerTransaction(DEBT)` + customer.balance ↑.
    Credit-limit check mirrors `CustomerTransactionsService.createDebt`
    (`customer_transactions.approve_over_limit` permission required to bypass).
  - Cancel CREDIT reverses balance + soft-marks linked DEBT row.
  - Recomputes daily-income after every mutation.
- **Tests**: **+11 jest tests** covering all three modes + cancel reversal +
  FROZEN customer block + credit-limit guard + approve permission path.
- **Frontend**: NOT YET WIRED.
  - API client written (`apps/web/src/lib/api/sales.ts`).
  - `/sales`, `/sales/new` (3-mode picker), `/sales/:id` + nav still TODO.

---

### Phase 7 — Reports (11 types) ❌ NOT STARTED
- Daily summary, P&L (accurate vs estimated), cash flow, customer debts ageing,
  supplier balances, top customers, top items, expenses-by-category,
  sales-by-mode, sales-by-worker, monthly summary.
- Server-side calculations only (no UI aggregation).
- Permissions split into `view`, `print`, `export` per report.

**Depends on Phases 4, 5, 6.**

---

### Phase 8 — Notifications advanced + WhatsApp templates + cron + behavior ❌ NOT STARTED
> A **subset** of notifications already exists from Phase 3 (`Notification`
> model + list/unread/mark-read endpoints + `NotificationBell` UI). Phase 8
> adds templates, cron jobs, and behavior analysis.

- New models: `NotificationTemplate`, `ScheduledJob`, `CustomerBehaviorAlert`.
- Cron via `@nestjs/schedule`: daily reminders (9 AM), behavior analysis
  (11 PM), weekly idempotency-key cleanup, monthly archival.
- Template editor UI at `/admin/templates`.

> The current PR ships a one-shot `purge:idempotency` command + sweeper service
> that the Phase-8 cron will simply call on its schedule.

---

### Phase 9 — Inventory (optional) ❌ NOT STARTED
- Models: `Product`, `StockMovement`.
- Gated by `Setting` row `inventory.enabled` (default false).
- Detailed sale → automatic stock-out; detailed purchase → stock-in.
- Negative stock blocked unless `inventory.allow_negative_stock = true`.

---

### Phase 10 — Polish + PWA + Railway deploy + E2E ❌ NOT STARTED
- All routes lazy-loaded (already partially done).
- Vendor chunk splitting; target initial < 300 KB gzip.
- Service Worker: CacheFirst static, NetworkOnly `/api/*`.
- App shortcuts in `manifest.webmanifest`.
- Playwright ≥ 30 E2E tests across mobile (375×667), tablet (768×1024),
  desktop (1440×900).
- Railway deployment (API + web + Postgres), GitHub Actions CI.
- Final docs.

---

## Database — Prisma

**Schema location**: `prisma/schema.prisma` (root, not under `apps/api`).

**18 models implemented** (verified by reading the merged file):
1. `Store`
2. `Setting`
3. `User`
4. `Role`
5. `Permission`
6. `RolePermission`
7. `UserRole`
8. `RefreshToken`
9. `IdempotencyKey`
10. `AuditLog`
11. `Customer`
12. `CustomerTransaction`
13. `CustomerReminderSettings`
14. `Notification`
15. `Supplier`
16. `SupplierTransaction`
17. `Purchase`
18. `PurchaseItem`

**Migrations applied** (`prisma/migrations/`):
1. `20260428011941_init_phase2_auth/` — models 1–10
2. `20260430021035_p3_customers_notifications/` — models 11–14
3. `20260503010000_p4_suppliers_purchases/` — models 15–18

**Models from `docs/03-database-design.md` that are NOT yet in schema** (must
be added by their respective phases):
- Phase 5: `ExpenseCategory`, `Expense`, `DailyIncome`
- Phase 6: `Sale`, `SaleItem`
- Phase 7: `ReportSnapshot`
- Phase 8: `NotificationTemplate`, `ScheduledJob`, `CustomerBehaviorAlert`
- Phase 9: `Product`, `StockMovement`

> When adding any of the above, DO NOT touch the existing 18 models without
> explicit user approval — see `docs/12-agent-memory.md`.

---

## Permissions — implementation reality

The full **181** permission codes across **19** modules **are declared** in
`packages/shared/src/constants/permissions.ts` (verified). Backend guards
reference them via `@RequirePermission`. Frontend `<PermissionGate>` and
`useAuthStore.hasPermission()` consume the same source.

**Guarded by real endpoints today** (Phases 1–4):
- `system.dashboard.view`
- `users.*` (9 codes), `roles.*` (8 codes), `permissions.view`
- `customers.*` (15 codes), `customer_transactions.*` (8 codes)
- `notifications.view_own`, `notifications.mark_read`
- `suppliers.*` (12 codes), `supplier_transactions.*` (6 codes)
- `purchases.*` (8 codes)

The remaining ≈ 100 codes (sales, expenses, reports, inventory, etc.) are
**declared but unguarded** because the modules they protect don't exist yet.
This is intentional — the seed assigns them to roles in advance.

---

## Maintenance gaps closed in the current PR

| Gap                                                                          | Status        | Fix                                                                                  |
| ---------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| Status docs (`PROJECT_STATUS.md`, `AGENT_HANDOFF.md`) were pre-Phase-4 stale | ✅ done       | Refreshed to reflect 18 models, 3 migrations, 336+ tests, Phase 4 ✅                 |
| Bottom-nav / Sidebar did not expose `/notifications`                         | ✅ done       | `BottomNav` + `Sidebar` updated; +7 nav-visibility tests                              |
| AuditLog rows used drift-prone inline shapes across services                 | ✅ done       | `writeAuditLog` helper introduced + purchases/suppliers refactored; +6 helper tests   |
| `/account` lacked an active-sessions list (no `GET /auth/sessions`)          | ⏭️ deferred   | Tracked in `docs/MASTER_PLAN.md` § Task 4 — separate PR for scope clarity            |
| No GC for `IdempotencyKey` rows (24-h TTL accumulates forever)               | ⏭️ deferred   | Tracked in `docs/MASTER_PLAN.md` § Task 5 — combine with Phase-8 cron                |

---

## Toolchain quirks (sandbox-specific)

| Quirk                                                                       | Why                                                                              | Workaround                                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm install` ≈ 23 s                                                       | Heavy deps (Ionic, framer, lucide).                                              | Cache `~/.pnpm-store` between sessions if possible.                                       |
| `pnpm typecheck` (recursive) **fails on a clean clone**                     | `tsc` resolves `@grocery/shared` from `dist/`, not `src/`.                       | Always run `pnpm --filter @grocery/shared build` first.                                   |
| `pnpm build` (full monorepo) hits 240 s `Bash` timeout                      | Vite + Nest build in parallel exhaust sandbox CPU.                               | Build per-package.                                                                        |
| `pnpm --filter @grocery/web test -- --run` ≈ 28 s                           | Vitest cold start + JSDOM environment setup.                                     | Use `--changed` for incremental local runs.                                               |
| No PostgreSQL → no `prisma migrate dev`                                     | Sandbox doesn't ship pg.                                                         | Hand-write migration SQL; apply on Railway in Phase 10.                                   |
| No headless browser → no Playwright / no real screenshots                   | Sandbox doesn't ship Chromium.                                                   | Document expected screenshots; capture during Phase 10.                                   |

---

## Where to dig before writing code

1. **Pattern reference (CRUD service)**: `apps/api/src/modules/customers/customers.service.ts`.
2. **Atomic transactions**: `apps/api/src/modules/customers/customer-transactions.service.ts`.
3. **Two-path service (cash vs credit)**: `apps/api/src/modules/purchases/purchases.service.ts`.
4. **Frontend page pattern**: `apps/web/src/pages/customers/CustomerDetailPage.tsx`.
5. **Modal pattern**: `apps/web/src/components/customers/AddDebtModal.tsx`.
6. **Backend test pattern**: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`.
7. **Frontend test pattern**: `apps/web/src/components/customers/__tests__/BalanceDisplay.test.tsx`.

---

## Open questions for the next agent

1. **Phase ordering after 4** — is `4 → 5 → 6 → 7` strict (per
   `docs/11-development-roadmap.md`), or can Phase 6 (Sales) ship before 5
   (Expenses) since Phase 6 depends on 3 only?
2. **Live PostgreSQL availability** — once available, run all migrations + seed
   + smoke tests, capture screenshots, and update `knowledge-base/10-audit-report.md`.
3. **Audit-log retention** — current rows live forever. Define a retention
   policy before Phase 8 archival cron is written.
on** — current rows live forever. Define a retention
   policy before Phase 8 archival cron is written.

---

## Phase 5 + 6 Frontend Addendum (2026-05-20)

The frontend layer for Phases 5 and 6 was added on branch
`phase56_frontend_and_polish`. Test totals updated to **401 / 401 passing**
(97 shared + 155 api + 149 web).

### Phase 5 Frontend — Expenses + Daily Income ✅
- **Components** (`apps/web/src/components/expenses/`):
  - `ExpenseTypeBadge.tsx` — 3-state badge (NORMAL/SUPPLIER_PAYMENT/CASH_PURCHASE_LINK).
  - `ExpenseCard.tsx` — list-row card with type badge, amount, cancelled state.
- **Pages** (`apps/web/src/pages/expenses/`):
  - `ExpensesListPage.tsx` — filters (type/cancel) + pagination + permission-gated CTA.
  - `NewExpensePage.tsx` — 3-mode picker form with conditional supplier/purchase pickers
    and locked-rule info banner per mode.
  - `ExpenseDetailPage.tsx` — read-only view + Cancel modal with mode-aware reversal
    description + linked supplier/purchase navigation.
  - `ExpenseCategoriesPage.tsx` — admin CRUD with create/edit modal + soft-delete.
- **Daily Income pages** (`apps/web/src/pages/daily-income/`):
  - `DailyIncomeTodayPage.tsx` — live snapshot, open/close/recompute actions,
    7-row aggregates grid with no-double-count rule visualised.
  - `DailyIncomeHistoryPage.tsx` — past days with from/to date filter + closed-only toggle.
  - `DailyIncomeByDatePage.tsx` — read-only detail page for any historical day.
- **Tests**: 8 vitest specs (ExpenseTypeBadge 3, ExpenseCard 5).
- **Routes**: 7 new `<ProtectedRoute>` entries registered.
- **Sidebar**: added "إيرادات اليوم" nav item (gated by `daily_income.view`).

### Phase 6 Frontend — Sales (3 modes) ✅
- **Components** (`apps/web/src/components/sales/`):
  - `SaleModeBadge.tsx` — 3-state badge (QUICK/DETAILED/CREDIT).
  - `SaleCard.tsx` — list-row card with mode badge + cash/customer label.
  - `SaleItemsTable.tsx` — editable items table (unitPrice instead of unitCost).
- **Pages** (`apps/web/src/pages/sales/`):
  - `SalesListPage.tsx` — filters (mode/cancel) + pagination.
  - `NewSalePage.tsx` — 3-mode picker with credit-limit pre-flight check:
    - QUICK forbids items, no customer.
    - DETAILED allows items (must reconcile ±0.01).
    - CREDIT requires customer; computes balanceBefore + balanceAfter from
      cached customer data; shows yellow warning when balanceAfter > creditLimit;
      acknowledgement checkbox gated by `customer_transactions.approve_over_limit`
      permission; server still re-validates and returns `CREDIT_LIMIT_EXCEEDED`
      if the actor lacks the permission.
  - `SaleDetailPage.tsx` — read-only view + items table + Cancel modal with
    mode-aware reversal description + linked customer navigation.
- **Tests**: 11 vitest specs (SaleModeBadge 3, SaleCard 5, SaleItemsTable 3).
- **Routes**: 3 new `<ProtectedRoute>` entries registered.

### Deferred follow-ups (out of this PR)
- **Sessions UI**: backend `GET /auth/sessions` + `POST /auth/sessions/:id/revoke`
  + frontend `<SessionsList />` component in `/account`.
- **Idempotency GC**: `IdempotencyCleanerService.purgeExpired()` + CLI command for cron.
- **Phases 7-10**: require live DB on Railway + real browser for E2E
  (out of sandbox scope).
