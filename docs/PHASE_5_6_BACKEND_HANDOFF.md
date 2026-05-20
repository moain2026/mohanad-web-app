# Phase 5 + Phase 6 Backend Handoff

> **Branch**: `phase5_expenses_daily_income`
> **State**: backend complete + tests green; frontend pages still pending.
> **Tests on this branch**: shared 97 + api 155 + web 130 = **382 / 382 passing**.
> **Lint**: 0 errors, 11 warnings (all pre-existing or intentional `!`).
> **Typecheck**: clean across all 3 packages.

---

## What landed in this PR

### 1. Prisma schema (5 models + 2 enums)

`prisma/schema.prisma` — added between `PurchaseItem` and the ENUMS divider:

| Model              | Purpose                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `ExpenseCategory`  | Per-store category catalog with soft-delete.                                                   |
| `Expense`          | 3-mode expense (NORMAL / SUPPLIER_PAYMENT / CASH_PURCHASE_LINK).                               |
| `DailyIncome`      | Per-day aggregate, unique on `(storeId, date)`. Immutable once `closedAt` is set.              |
| `Sale`             | 3-mode sale (QUICK / DETAILED / CREDIT).                                                       |
| `SaleItem`         | Optional line items for DETAILED/CREDIT sales (`productId` reserved for Phase 9).              |

Relations were also added on `Store`, `User`, and `Customer`. `pnpm db:validate`
passes (with a dummy `DATABASE_URL`); `pnpm db:generate` succeeded.

### 2. Migration SQL (hand-written)

`prisma/migrations/20260520010000_p5_p6_expenses_daily_income_sales/migration.sql`
— PostgreSQL DDL stylistically identical to the auto-generated Phase 4
migration. Requires a live database to apply (sandbox has no PostgreSQL).

### 3. Shared schemas

- `packages/shared/src/schemas/expenses.ts` — Zod schemas for categories + 3-mode
  expense creation with conditional `supplierId` / `purchaseId` guards.
- `packages/shared/src/schemas/daily-income.ts` — open-day, close-day, recompute,
  list inputs.
- `packages/shared/src/schemas/sales.ts` — 3-mode sale + items total reconciliation.
- `index.ts` updated to re-export the new modules.

### 4. NestJS modules

#### `apps/api/src/modules/expenses/`
- `expenses.service.ts` — 3 paths with the **locked accounting rules**:
  - NORMAL → Expense row only.
  - SUPPLIER_PAYMENT → atomic Expense + `SupplierTransaction(PAYMENT)` +
    supplier balance ↓ (cross-linked via `referenceType`).
  - CASH_PURCHASE_LINK → Expense row only, references the existing
    `Purchase.id`. **NO** supplier touch — daily-income reads cash purchases
    from `purchases` to avoid double-counting.
- `expense-categories.service.ts` — CRUD with soft-delete + uniqueness check.
- Two controllers + module wired into `AppModule`.

#### `apps/api/src/modules/daily-income/`
- `daily-income.service.ts`:
  - `recompute(storeId, date)` aggregates from authoritative sources:
    `cashSales`/`creditSales` from `sales` (grouped by mode), `customerPayments`
    from `customer_transactions`, **`cashPurchases` from `purchases`** (the
    no-double-count invariant), `normalExpenses` + `supplierPayments` from
    `expenses` grouped by `type`.
  - `closingCash = opening + cashSales + customerPayments − cashPurchases −
    supplierPayments − normalExpenses`.
  - Closed-day recompute is a no-op (immutable).
- `openDay`, `closeDay`, `getByDate` (lazy-creates), `list`.
- Controller exposes `/daily-income`, `/daily-income/today`, `/daily-income/:date`
  (YYYY-MM-DD), `POST /daily-income/{open,close,recompute}`.

#### `apps/api/src/modules/sales/`
- `sales.service.ts` — 3 paths:
  - QUICK / DETAILED → cash, optional items (DETAILED only). Hits `cash_sales`.
  - CREDIT → atomic Sale + `CustomerTransaction(DEBT)` referencing the sale +
    customer balance ↑. Credit-limit check mirrors `customer-transactions`
    pattern (uses `customer_transactions.approve_over_limit` permission).
  - Cancel CREDIT reverses balance + soft-marks the linked DEBT row.
- After every mutation, calls `dailyIncome.recompute()`.

### 5. Jest tests (+33 total)

- `expenses.service.spec.ts` — 13 tests covering all three modes, both cancel
  paths, supplier balance arithmetic, and the CASH_PURCHASE_LINK guard rails
  (refuse CREDIT purchase, refuse cancelled purchase, no supplier touch).
- `daily-income.service.spec.ts` — 9 tests including the **explicit**
  `purchase.aggregate({ where: { paymentType: 'CASH' } })` assertion to enforce
  the no-double-count rule + the full closing-cash formula calculation.
- `sales.service.spec.ts` — 11 tests across all three modes + cancel reversal +
  FROZEN customer block + credit-limit guard + over-limit approval path.

### 6. Frontend API clients

- `apps/web/src/lib/api/expenses.ts` — typed clients for both expenses and
  expense categories.
- `apps/web/src/lib/api/daily-income.ts` — list, today, byDate, open, close,
  recompute.
- `apps/web/src/lib/api/sales.ts` — list, get, create, cancel.

---

## What is NOT yet done (frontend pages)

To finish Phase 5 + Phase 6 end-to-end, the next agent should:

1. **Phase 5 frontend pages**
   - `/expenses` (list with category + type filters; mirror `PurchasesListPage.tsx`).
   - `/expenses/new` — 3-mode picker (NORMAL / SUPPLIER_PAYMENT / CASH_PURCHASE_LINK).
     - NORMAL → category + amount + description.
     - SUPPLIER_PAYMENT → category + supplier picker + amount + description.
     - CASH_PURCHASE_LINK → category + purchase picker (filter CASH +
       non-cancelled only) + amount + description.
   - `/expense-categories` (admin) — CRUD page guarded by
     `expense_categories.manage`.
   - `/daily-income` — today's row with `openDay` / `closeDay` actions.
   - `/daily-income/history` — list with date filter, link to per-day detail.
   - Add routes to `apps/web/src/routes.tsx` and nav items to BottomNav + Sidebar.
   - Write Vitest specs (mirror `PurchasesListPage` test style).

2. **Phase 6 frontend pages**
   - `/sales` (list with mode filter).
   - `/sales/new` — 3-mode picker (QUICK / DETAILED / CREDIT).
     - QUICK → just totalAmount.
     - DETAILED → totalAmount + optional items table (reuse the items table
       from purchases as a reference pattern).
     - CREDIT → customer picker + amount + items + handles credit-limit
       confirmation modal (server returns `CREDIT_LIMIT_EXCEEDED` code).
   - `/sales/:id` — detail page with items + cancel action.
   - Routes + nav as above.
   - Vitest specs.

3. **Deferred maintenance tasks** (still applicable — carried over from PR #9)
   - Sessions UI: `GET /auth/sessions` + `POST /auth/sessions/:id/revoke` +
     `<SessionsList />` component in `/account`.
   - Idempotency GC: `IdempotencyCleanerService.purgeExpired` + CLI command
     for cron operation.

4. **Phases 7-10** — these need a live PostgreSQL on Railway + a real browser
   for E2E, so they cannot be completed from the sandbox:
   - Phase 7 — Reports (server-side aggregation only; can be implemented as
     code + unit tests but real verification needs DB).
   - Phase 8 — Notifications-advanced + cron stubs.
   - Phase 9 — Inventory (gated by `Setting`).
   - Phase 10 — Polish + PWA + Railway deploy + Lighthouse.

---

## How to verify on a fresh checkout

```bash
git checkout phase5_expenses_daily_income
pnpm install
pnpm --filter @grocery/shared build
DATABASE_URL="postgresql://dummy" pnpm db:validate   # PASS
DATABASE_URL="postgresql://dummy" pnpm db:generate   # PASS
pnpm lint                                            # 0 errors, 11 warnings
pnpm typecheck                                       # PASS
pnpm test                                            # 382 / 382 passing
```

To apply the migration on Railway:

```bash
pnpm db:migrate deploy   # applies 20260520010000_p5_p6_expenses_daily_income_sales
```

---

## Critical invariants locked in tests

Read `docs/12-agent-memory.md` for the full lock list. Phase 5/6 invariants
exercised here:

1. **No double count**: `DailyIncomeService.recompute` reads `cash_purchases`
   from `purchases`, **not** from `expenses.CASH_PURCHASE_LINK`. Test:
   `daily-income.service.spec.ts` → "reads cash_purchases from purchases (NOT
   from expenses) — no double count".
2. **Atomic supplier payment**: `ExpensesService.create({type: SUPPLIER_PAYMENT})`
   creates the Expense row, a linked `SupplierTransaction(PAYMENT)`, and
   updates `Supplier.currentBalance` inside one `$transaction`. Test:
   `expenses.service.spec.ts` → "atomically: Expense + SupplierTransaction(PAYMENT) + balance 500-200=300".
3. **Atomic credit sale**: `SalesService.create({mode: CREDIT})` creates the
   Sale row, `CustomerTransaction(DEBT)` referencing the sale, and updates
   `Customer.currentBalance` inside one `$transaction`. Test:
   `sales.service.spec.ts` → "atomically creates Sale + CustomerTransaction(DEBT) + bumps balance".
4. **Cancel reverses**: cancelling a SUPPLIER_PAYMENT expense or a CREDIT sale
   reverses the original balance change AND soft-marks the linked ledger row.
   Tests verify both arithmetic and the soft-mark.
5. **Credit-limit gate**: a CREDIT sale that would put the customer over their
   limit throws `CREDIT_LIMIT_EXCEEDED` unless the actor holds
   `customer_transactions.approve_over_limit`.
