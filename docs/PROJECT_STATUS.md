# PROJECT_STATUS.md — Truthful Per-Phase Reality

> **Last updated**: 2026-05-03 (after merge of PR #6 → `genspark_ai_developer`).
> **Authoritative**: when this file disagrees with any `docs/00..13-*.md` design document, **this file wins** for "what exists in the code today". Design docs describe the **target**, not the current implementation.
> **Verification method**: every entry below was confirmed by direct inspection of the merged tree at commit `78c5c22`.

This document is intentionally pessimistic about what is shipped. If you read it and think "but the spec says X exists" — the spec is the **target spec**, not the current state. Open `apps/api/src/modules/` and verify before writing code.

---

## TL;DR

| | Done | Tests |
|---|---|---|
| **Phases shipped** | 1, 2, 3 | shared 69 + api 70 + web 92 = **231 / 231 passing** |
| **Phases NOT started** | 4, 5, 6, 7, 8 (advanced), 9, 10 | 0 |
| **Coverage on critical** | auth 94 %, permissions guard 100 %, users 90 %, roles 96 %, idempotency 92 % | — |
| **Lighthouse (Phase-1 baseline)** | Perf 81 · A11y 92 · BP 96 · SEO 91 | needs HTTPS for full PWA score |

---

## Branch model

| Branch | Purpose | State |
|--------|---------|-------|
| `main` | Stable releases (placeholder, nothing merges to it yet) | empty target |
| `genspark_ai_developer` | Integration branch — every phase merges here via PR | ⭐ current head: `78c5c22` (post-PR-#6 merge) |
| `genspark_recovery` | Phase-1 + Phase-2 recovery work | merged |
| `phase34_completion` | Phase-3 frontend work | merged via PR #6 |
| `docs/accurate-status-and-handoff` | Documentation refresh (this file) | open |
| `phase4_suppliers_purchases` | Next phase — **does not exist yet** | TBD |

---

## Phase-by-phase reality

### Phase 0 — Documentation ✅
- All 13 numbered design docs (`docs/00..13-*.md`) plus `12-agent-memory.md` (locked decisions) and `recovery-report.md` exist.
- Status: stable. The recent additions are this file (`PROJECT_STATUS.md`), `AGENT_HANDOFF.md`, and the `knowledge-base/` audit folder (2026-05-02).
- **Caveat**: `docs/03-database-design.md` describes the full target schema (≈ 27 models). Only **14** are implemented. See [§ Database below](#database--prisma).

---

### Phase 1 — Foundation ✅
Merged from `genspark_recovery` (commit `3f5eb1c` and earlier).

**Backend** (`apps/api`):
- NestJS 10 scaffolded with global pipes, filters, interceptors:
  - `AllExceptionsFilter` — uniform error envelope
  - `ResponseFormatInterceptor` — wraps responses in `{ data, meta }`
  - `ZodValidationPipe` — Zod-based body/query validation
  - `RequestIdMiddleware` — x-request-id header propagation
- `ConfigModule` with Zod env validation (`apps/api/src/config/`).
- `LoggerModule` (nestjs-pino) with redaction of sensitive headers.
- `ThrottlerModule` — global rate limit 100 req/min.
- `JwtModule` registered globally (no strategy until Phase 2 — done).
- `PrismaModule` — singleton client with graceful shutdown.
- API prefix: `/api/v1/`.
- Health: `GET /api/v1/health` returns `{ status: 'ok', uptime, timestamp }`.

**Frontend** (`apps/web`):
- Vite + React 18 + TypeScript 5.5.
- Ionic React 8 (locked to React-Router v5 — see [`docs/12-agent-memory.md`](./12-agent-memory.md)).
- Tailwind CSS 3 + `tailwindcss-rtl` plugin.
- Design system: 13 UI primitives (`apps/web/src/components/ui/`), 5 layout components, 3 dashboard widgets.
- Self-hosted Arabic fonts (IBM Plex Sans Arabic, JetBrains Mono) under `apps/web/public/fonts/`.
- PWA scaffolding: 8 icons, manifest, service worker via `vite-plugin-pwa` (basic precache only — advanced strategies belong to Phase 10).
- Lighthouse baseline: **Performance 81 · Accessibility 92 · Best-Practices 96 · SEO 91 · LCP 4.1 s · CLS 0**.

**Shared** (`packages/shared`):
- Empty schemas/constants placeholders + Zod re-exports.
- Vitest configured.

---

### Phase 2 — Auth + RBAC ✅
Merged from `genspark_recovery` via PRs #2–#5.

**Backend modules implemented**:
- `apps/api/src/modules/auth/`
  - Endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/me`, `POST /auth/change-password`.
  - JWT: 15 min access (in-memory on the client), 7 days refresh (httpOnly cookie), 30 days remember-me.
  - bcrypt rounds = 12.
  - Refresh-token rotation with revocation; family-wide revocation on reuse detection.
  - Lockout: 5 failed attempts in 15 min → 429 with `Retry-After`.
  - Coverage: **94 % statements, 90 % branches, 100 % functions**.
- `apps/api/src/modules/users/`
  - Full CRUD + `assignRoles`, `resetPassword`, `activate`, `deactivate`, `viewActivity`.
  - Soft-delete via `deletedAt`.
  - Coverage: **≈ 90 % statements**.
- `apps/api/src/modules/roles/`
  - CRUD + `clone`, `setPermissions`, `viewPermissions`.
  - System roles guarded (cannot delete or rename).
  - Coverage: **≈ 96 % statements**.
- `apps/api/src/modules/permissions/`
  - `GET /permissions` — returns the 181-entry catalog with Arabic labels and group metadata.
- Idempotency middleware (`apps/api/src/common/middleware/idempotency.middleware.ts`)
  - Stores `Idempotency-Key` for 24 h.
  - Replays first response for duplicate keys.
  - Coverage: **≈ 92 % statements, 88 % branches**.
- Global guards: `JwtAuthGuard` (default) and `PermissionsGuard` (per-route via `@RequirePermission` / `@RequireAnyPermission` / `@RequireAllPermissions`). Coverage **100 %**.

**Frontend pages implemented**:
- `/login` — username + password, lockout-aware countdown, "remember me", server-driven error envelope rendering.
- `/dashboard` — KPIs placeholders + sparkline + quick actions; permission-gated widgets.
- `/admin/users` (list) and `/admin/users/:id` (detail).
- `/admin/roles` (list), `/admin/roles/new`, `/admin/roles/:id` (edit form with `PermissionsEditor`).
- `/account` — read-only profile + change password modal.

**Shared additions**:
- `packages/shared/src/constants/permissions.ts` — **181** permission codes across **19** modules; this is the single source of truth for backend guards, Prisma seed, and frontend `<PermissionGate>`.
- `packages/shared/src/constants/roles.ts` — 6 system roles (owner, manager, accountant, sales_worker, inventory_officer, viewer).
- `packages/shared/src/schemas/{auth,users,roles}.ts` — Zod input schemas.

**Tests** (Phase 2 baseline): shared 69 + api 70 + web 69 = **208**.

**Known limitations** (carried from `recovery-report.md`):
- Role `usersCount` includes soft-deleted users (cosmetic).
- No audit-log entries are written yet (the table exists, no module emits to it).
- `/account` lacks an active-sessions list (the `RefreshToken` rows exist but no UI).
- No GC for `IdempotencyKey` rows (must be cleaned up by the cron in Phase 8).
- Lighthouse PWA score limited because the dev server is HTTP-only.

---

### Phase 3 — Customers + Debts ✅
Merged from `phase34_completion` via PR #6 (commit `78c5c22`, 2026-05-03).

**Backend** (`apps/api/src/modules/customers/`):
- `customers.service.ts` (~330 LOC) — `list`, `findOne`, `getBalance`, `statement`, `create` (with optional opening-balance ledger row), `update`, `remove` (rejected when `currentBalance != 0`), `freeze`, `unfreeze`, `grantGrace`, `setCreditLimit`. Soft-delete via `deletedAt`.
- `customer-transactions.service.ts` (~280 LOC) — `list`, `createDebt`, `createPayment`, `createAdjustment`, `cancel`. Each mutation runs inside `prisma.$transaction(async (tx) => { … })`. Errors are Arabic with stable codes: `CUSTOMER_FROZEN`, `CREDIT_LIMIT_EXCEEDED`, `INVALID_AMOUNT`, `TX_NOT_FOUND`, `TX_ALREADY_CANCELLED`, `TX_OPENING_PROTECTED`. Frozen customers cannot incur debt; over-limit debts require an extra permission AND `approveOverLimit: true` in the body. A `CREDIT_LIMIT_EXCEEDED` notification row is created when applicable.
- `customers.controller.ts` — 10 REST endpoints all guarded by `@RequirePermission`.
- `customer-transactions.controller.ts` — 5 endpoints under `/customers/:id/transactions`.
- `customers.module.ts` — registers both services and controllers.

**Backend** (`apps/api/src/modules/notifications/`):
- `notifications.service.ts` — `list` (with `type` and `unreadOnly` filters), `unreadCount`, `markRead`, `markAllRead`.
- `notifications.controller.ts` — 4 endpoints (view_own, mark_read).

**Frontend (PR #6)**:
- API clients: `apps/web/src/lib/api/customers.ts`, `apps/web/src/lib/api/notifications.ts`.
- WhatsApp util: `apps/web/src/lib/whatsapp.ts` — `applyTemplate`, `generateWhatsAppLink`, `WHATSAPP_TEMPLATES`.
- Components (`apps/web/src/components/customers/`):
  - `BalanceDisplay` (debt = red, credit = blue, clear = green; Arabic locale formatting; tabular-nums)
  - `StatusBadge` (ACTIVE / FROZEN / GRACE_PERIOD with icons)
  - `CustomerCard` (list-row card linking to detail)
  - `TransactionsTimeline` (vertical ledger with cancel handling)
  - `WhatsAppButton` (disabled when phone missing; opens wa.me in new tab)
  - `AddDebtModal` (live preview, frozen guard, credit-limit warning + approve checkbox)
  - `RecordPaymentModal` (live preview, over-payment → credit warning)
- Components (`apps/web/src/components/notifications/`):
  - `NotificationBell` (30 s staleTime, 60 s refetch, badge capped at "9+")
- Pages:
  - `/customers` — debounced search + status filter + paginated list.
  - `/customers/new` — full create form (name, phone, whatsappPhone, address, opening balance, credit limit, notes).
  - `/customers/:id` — header card + action grid (debt / payment / WhatsApp / freeze) + recent transactions.
  - `/customers/:id/edit` — update mutable fields.
  - `/customers/:id/statement` — paginated full ledger with browser print.
  - `/notifications` — list + per-row mark-read + global mark-all-read.

**Routes** (in `apps/web/src/routes.tsx`):
```
/customers                      ← customers.view
/customers/new                  ← customers.create
/customers/:id                  ← customers.view
/customers/:id/edit             ← customers.update
/customers/:id/statement        ← customers.view_transactions
/notifications                  ← notifications.view_own
```

**Tests added in PR #6** (web only, +23):
- `whatsapp.test.ts` (8) — template substitution, fallback phone selection, missing-phone null, digit stripping.
- `BalanceDisplay.test.tsx` (7) — helpers + tone data attributes.
- `StatusBadge.test.tsx` (3) — three statuses + grace date suffix.
- `CustomerCard.test.tsx` (3) — render + link target + frozen state.
- `WhatsAppButton.test.tsx` (2) — enabled click opens link, disabled when no phone.

**What is intentionally NOT in Phase 3** (deferred):
- Bonus animations (count-up, confetti on zero balance) — base UI shipped first.
- Keyboard shortcuts (D / P / W) — deferred.
- `customer-reminder-settings` UI — backend table exists (`CustomerReminderSettings`), no UI yet.
- Bottom-nav and Sidebar **do not yet link** to `/customers` and `/notifications` — must be added in a small follow-up. (The routes work, but discoverability via nav is missing.)
- No live screenshots (sandbox has no PostgreSQL + no browser).
- No backend audit-log entries are emitted from the customer modules either — same gap as Phase 2.

---

### Phase 4 — Suppliers + Purchases ❌ NOT STARTED
**Branch**: not yet created. Recommended name: `phase4_suppliers_purchases`.

**What needs to be built** (from [`docs/06-modules.md`](./06-modules.md) + [`docs/12-agent-memory.md`](./12-agent-memory.md)):

1. **Prisma migration `p4_suppliers_purchases`**, adding:
   - `Supplier` (id, storeId, name, phone, whatsappPhone, address, notes, openingBalance, currentBalance, isActive, createdById, timestamps, soft-delete)
   - `SupplierTransaction` (id, supplierId, type ∈ {`OPENING`, `CREDIT_PURCHASE`, `PAYMENT`, `ADJUSTMENT`}, amount, balanceBefore, balanceAfter, referenceType, referenceId, notes, cancelledAt, cancelReason, createdById, createdAt)
   - `Purchase` (id, storeId, supplierId, paymentType ∈ {`CASH`, `CREDIT`}, totalAmount, notes, hasItems boolean, cancelledAt, cancelReason, createdById, createdAt)
   - `PurchaseItem` (id, purchaseId, productId nullable, name, quantity, unitCost, totalCost) — `productId` is null until Phase 9 makes inventory available.

2. **Permissions** (already declared in `packages/shared/src/constants/permissions.ts` — verified during the 2026-05-02 audit): `suppliers.*`, `supplier_transactions.*`, `purchases.*`. Update Prisma seed to assign them to roles.

3. **Backend**:
   - `SuppliersService` (mirrors `CustomersService`): list, findOne, getBalance, statement, create (with opening-balance ledger), update, remove, restore, setOpeningBalance, printStatement.
   - `SupplierTransactionsService`: list, createPayment, createAdjustment, cancel — atomic; uses `SELECT FOR UPDATE`.
   - `PurchasesService` with two distinct paths:
     - `createCashPurchase` — creates `Purchase` only, **NO supplier balance change**.
     - `createCreditPurchase` — creates `Purchase` + `SupplierTransaction(CREDIT_PURCHASE)` + updates `Supplier.currentBalance`, all in one `prisma.$transaction`.
     - `cancelPurchase` — for credit purchases, atomically reverses the supplier balance.
   - Controllers + Module wiring.

4. **Frontend** (mirror Phase-3 UX):
   - `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/suppliers/:id/edit`, `/suppliers/:id/statement`.
   - `/purchases`, `/purchases/new` (3-step wizard: pick supplier → enter total/items → choose payment type with live preview), `/purchases/:id`.
   - Components: `PaymentTypeRadio` (visual cards), `SupplierPickerInline`, reuse `BalanceDisplay`, `StatusBadge`-equivalent, `TransactionsTimeline`-equivalent.
   - Update `Sidebar` and `BottomNav` to expose Suppliers + Purchases.

5. **Tests** (target ≥ 30 new tests, same quality bar as Phase 3):
   - ⭐ Cash purchase does NOT change supplier balance.
   - ⭐ Credit purchase increases supplier balance by total.
   - ⭐ Cancel of credit purchase reverses balance.
   - Cancel of cash purchase does not touch balance.
   - Frozen / inactive supplier cannot have credit purchases.
   - Pagination + search + filter on list pages.

**Sandbox-specific gotchas for whoever picks this up**:
- No PostgreSQL → cannot run `pnpm db:migrate`. Hand-write the migration SQL into `prisma/migrations/<timestamp>_p4_suppliers_purchases/migration.sql` and rely on `tsc` + Jest unit specs for verification.
- Tests use `jest.mock('@nestjs/core')` patterns already established in `apps/api/src/modules/customers/__tests__/` — copy the structure.

---

### Phase 5 — Expenses + Daily Income ❌ NOT STARTED
- Models: `ExpenseCategory`, `Expense` (types: NORMAL, SUPPLIER_PAYMENT, CASH_PURCHASE_LINK), `DailyIncome`.
- Critical rule: `SUPPLIER_PAYMENT` → must call SuppliersService.createPayment to update balance; `CASH_PURCHASE_LINK` → references a Phase-4 `Purchase.id` and **does not** create a separate financial ledger entry (no double-counting).
- Frontend: `/expenses`, `/expenses/new`, `/daily-income`, `/daily-income/history`.

**Depends on Phase 4** (for SUPPLIER_PAYMENT type).

---

### Phase 6 — Sales (3 modes) ❌ NOT STARTED
- Models: `Sale`, `SaleItem`.
- Quick-sale flow target < 5 s tap-to-confirm.
- Detailed sale: line items (depends on Phase 9 if inventory is enabled; otherwise free-text items).
- Atomicity rules: credit sale → creates `CustomerTransaction(DEBT)` and respects credit limit; cash sale → records to `DailyIncome`.

**Depends on Phase 3** (customer transactions).

---

### Phase 7 — Reports (11 types) ❌ NOT STARTED
- Daily summary, P&L (accurate vs estimated), cash flow, customer debts ageing, supplier balances, top customers, top items, expenses-by-category, sales-by-mode, sales-by-worker, monthly summary.
- Server-side calculations only (no UI aggregation).
- Permissions split into `view`, `print`, `export` per report.

**Depends on Phases 4, 5, 6.**

---

### Phase 8 — Notifications advanced + WhatsApp templates + cron + behavior ❌ NOT STARTED
> Note: a **subset** of notifications already exists from Phase 3 (`Notification` model + list/unread/mark-read endpoints + `NotificationBell` UI). Phase 8 adds templates, cron jobs, and behavior analysis.

- New models: `NotificationTemplate`, `ScheduledJob`, `CustomerBehaviorAlert`.
- Cron via `@nestjs/schedule`: daily reminders (9 AM), behavior analysis (11 PM), weekly idempotency-key cleanup, monthly archival of old notifications.
- Template editor UI at `/admin/templates`.

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
- Playwright ≥ 30 E2E tests across mobile (375×667), tablet (768×1024), desktop (1440×900).
- Railway deployment (API + web + Postgres), GitHub Actions CI.
- Final docs.

---

## Database — Prisma

**Schema location**: `prisma/schema.prisma` (root, not under `apps/api`).

**14 models implemented** (verified by reading the merged file):
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

**Migrations applied** (`prisma/migrations/`):
1. `20260428011941_init_phase2_auth/` — models 1–10
2. `20260430021035_p3_customers_notifications/` — models 11–14

**Models from `docs/03-database-design.md` that are NOT yet in schema** (must be added by their respective phases):
- Phase 4: `Supplier`, `SupplierTransaction`, `Purchase`, `PurchaseItem`
- Phase 5: `ExpenseCategory`, `Expense`, `DailyIncome`
- Phase 6: `Sale`, `SaleItem`
- Phase 7: `ReportSnapshot` (already declared in `12-agent-memory.md` as available; **verify** in schema before assuming)
- Phase 8: `NotificationTemplate`, `ScheduledJob`, `CustomerBehaviorAlert`
- Phase 9: `Product`, `StockMovement`

> When adding any of the above, DO NOT touch the existing 14 models without explicit user approval — see `docs/12-agent-memory.md` for locked decisions.

---

## Permissions — implementation reality

The full **181** permission codes across **19** modules **are declared** in `packages/shared/src/constants/permissions.ts` (verified). Backend guards reference them via `@RequirePermission`. Frontend `<PermissionGate>` and `useAuthStore.hasPermission()` consume the same source.

However, **only the codes used by Phases 1–3 are guarded by real endpoints today**:
- `system.dashboard.view`
- `users.*` (9 codes)
- `roles.*` (8 codes)
- `customers.*` (15 codes)
- `customer_transactions.*` (8 codes)
- `notifications.view_own`, `notifications.mark_read`

The remaining ≈ 140 permission codes (suppliers, purchases, sales, reports, etc.) are **declared but unguarded** because the modules they protect don't exist yet. This is intentional — the seed assigns them to roles in advance so that adding the modules in later phases is a no-op for the role/permission table.

---

## Toolchain quirks (sandbox-specific)

| Quirk | Why | Workaround |
|-------|-----|------------|
| `pnpm install` ≈ 23 s | Heavy deps (Ionic, framer, lucide). | Cache `~/.pnpm-store` between sessions if possible. |
| `pnpm typecheck` (recursive) **fails on a clean clone** | `tsc` resolves `@grocery/shared` from `dist/`, not `src/`. | Always run `pnpm --filter @grocery/shared build` first. |
| `pnpm build` (full monorepo) hits 240 s `Bash` timeout | Vite + Nest build in parallel exhaust sandbox CPU. | Build per-package: `pnpm --filter @grocery/<pkg> build`. Or build on Railway/local workstation. |
| `pnpm --filter @grocery/web test -- --run` ≈ 28 s | Vitest cold start + JSDOM environment setup. | Use `--changed` for incremental local runs. |
| No PostgreSQL → no `prisma migrate dev` | Sandbox doesn't ship pg. | Hand-write migration SQL; apply on Railway in Phase 10. |
| No headless browser → no Playwright / no real screenshots | Sandbox doesn't ship Chromium. | Document expected screenshots; capture during Phase 10. |

---

## Where to dig before writing code

1. **Pattern reference**: `apps/api/src/modules/customers/customers.service.ts` — copy this for Phase 4 (`SuppliersService`).
2. **Atomic transactions**: `apps/api/src/modules/customers/customer-transactions.service.ts` — copy `createDebt` / `cancel` for Phase 4 credit-purchase logic.
3. **Frontend page pattern**: `apps/web/src/pages/customers/CustomerDetailPage.tsx` — copy for Suppliers detail page.
4. **Modal pattern**: `apps/web/src/components/customers/AddDebtModal.tsx` — copy for `RecordSupplierPaymentModal`.
5. **Test pattern (backend)**: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (94 % coverage) — best example of mocked Prisma patterns in this repo.
6. **Test pattern (web)**: `apps/web/src/components/customers/__tests__/BalanceDisplay.test.tsx` — minimal RTL + Vitest setup.

---

## Open questions that block deeper work

These need user direction before the next agent starts:

1. **Bottom-nav and Sidebar update** — should Phase-3 routes (`/customers`, `/notifications`) be wired into the navigation in a small follow-up PR, or as part of Phase 4?
2. **Audit logging gap** — neither Phase 2 nor Phase 3 modules emit to `AuditLog`. Is this acceptable until Phase 10 (security hardening pass), or should a dedicated cleanup PR cover it now?
3. **Live PostgreSQL availability** — once available, run all migrations + seed + smoke tests, capture screenshots, and update `knowledge-base/10-audit-report.md` Phase-3 section with live evidence.
4. **Phase ordering after 4** — is `4 → 5 → 6 → 7` strict (per `docs/11-development-roadmap.md`), or can Phase 6 (Sales) ship before 5 (Expenses) since Phase 6 depends on 3 only? The roadmap implies strict order.
