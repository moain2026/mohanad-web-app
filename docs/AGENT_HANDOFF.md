# AGENT_HANDOFF.md — Onboarding for the Next Session

> **Purpose**: this file is the **first thing** a new AI agent (or human developer) reads before touching the code. Treat it as a 10-minute safety briefing.
>
> **Last updated**: 2026-05-03 (post-PR-#6 merge, pre-Phase-4 work).
>
> **Companion files**:
> - [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — granular per-phase reality.
> - [`12-agent-memory.md`](./12-agent-memory.md) — locked product decisions (do not modify without explicit user approval).
> - [`../knowledge-base/`](../knowledge-base/) — 11-file audit folder generated 2026-05-02.
> - [`../README.md`](../README.md) — public-facing summary + roadmap.
> - [`../DEVELOPMENT.md`](../DEVELOPMENT.md) — daily commands cheatsheet.

---

## 0. Identity check

You are working on **Grocery System (نظام إدارة البقالة)** — a bilingual (Arabic-first RTL) PWA for managing a small-to-medium grocery store. The product is described in detail in `docs/00-project-overview.md`. Do **not** assume English UI; the entire product is Arabic.

**Repo:** `https://github.com/moain2026/mohanad-web-app`
**Integration branch:** `genspark_ai_developer`
**License:** proprietary.

---

## 1. The single most important rule

> **Implementation reality > spec docs.**
>
> When the implementation (`apps/api/src/modules/`, `apps/web/src/pages/`, `prisma/schema.prisma`) and any document under `docs/00..13-*.md` disagree, **the implementation wins**, and you must NOT silently change the implementation to match a spec doc. Open a question with the user first.

The only docs that are **authoritative for current state** are:
1. This file (`AGENT_HANDOFF.md`).
2. [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).
3. [`12-agent-memory.md`](./12-agent-memory.md) (locked decisions).
4. [`../knowledge-base/`](../knowledge-base/).

Everything else (00–13 numbered docs) describes the **target design** and is allowed to be ahead of the code.

---

## 2. What is shipped today (TL;DR)

| Phase | Title | Status | PR |
|------:|-------|:------:|----|
| 0 | Documentation (00–13 + memory) | ✅ done | n/a |
| 1 | Foundation (monorepo, schema, design system, PWA scaffold) | ✅ done | merged via #2/#3 |
| 2 | Auth + RBAC (181 permissions, admin UI, account, idempotency) | ✅ done | merged via #4/#5 |
| 3 | Customers + Debts + WhatsApp deep-links + Notifications UI | ✅ done | **#6 merged 2026-05-03 → commit `78c5c22`** |
| 4 | Suppliers + Purchases | ❌ **next** | — |
| 5–10 | Expenses, Sales, Reports, Notifications-advanced, Inventory, Polish/Deploy | ❌ not started | — |

**Tests passing**: 231 / 231 → shared 69 + api 70 + web 92.
**Tests required by Phase-4 DoD**: ≈ 260 (≥ 30 new).

The granular per-module breakdown is in `PROJECT_STATUS.md` § "Phase-by-phase reality".

---

## 3. Sandbox limits — before you estimate anything, read this

The genspark sandbox where most agent work happens has **hard** constraints. Estimating timelines without acknowledging them produces unrealistic plans.

| Limit | Symptom | Mitigation |
|-------|---------|------------|
| ❌ **No PostgreSQL service** | `prisma migrate dev` cannot run. The API cannot start end-to-end. No live `curl` evidence. No live screenshots. | Hand-write migration SQL into `prisma/migrations/<timestamp>_<name>/migration.sql`. Use **mocked Prisma** in unit tests. Defer live evidence to Railway (Phase 10). |
| ⏱ **`pnpm build` (full monorepo) > 240 s** | The `Bash` tool times out. | Build per-package: `pnpm --filter @grocery/shared build`, etc. Production builds run on Railway. |
| ❌ **No headless browser** | Playwright cannot run. No real screenshots. | Document expected screenshots; defer real captures to Phase 10. |
| ⚠ **`pnpm typecheck` fails on clean clone** | `tsc` looks for `@grocery/shared` in `dist/`, not `src/`. | **Always** run `pnpm --filter @grocery/shared build` first. |
| 🐢 **`pnpm install` ≈ 23 s** | Heavy deps (Ionic, framer-motion, lucide). | Don't call it in a tight loop. |
| ❌ **No `gh pr merge --auto`** in CI here | PRs must be merged manually by the user, OR via `gh pr merge <n> --merge` once green. | Use `gh pr view <n>` to verify mergeable state. |

**Rule:** if a phase's DoD requires a live database, real screenshots, or a passing E2E flow, it cannot be **fully** completed from the sandbox. Deliver everything that can be delivered (schema, code, mocked tests, docs) and clearly mark the deferred items in the PR description.

---

## 4. Locked decisions (recap — full list in `12-agent-memory.md`)

These are baked into the codebase. **Do not change them** without explicit user approval.

1. **Money columns** = `Decimal(14, 2)` (Prisma) → strings on the wire → never `Number()` for arithmetic.
2. **Ionic 8** is the UI shell, which **locks React-Router to v5** (Ionic 8 is incompatible with RR v6+). Routes use `<Switch>` + `<Route>`, not `<Routes>` + `<Route element=…>`.
3. **Biome 1.9.4** is the only lint/format tool. ESLint and Prettier are removed.
4. **pnpm 9.15.9** is the only package manager. **Lockfile is canonical**; do not regenerate it manually.
5. **Tailwind RTL plugin** is mandatory. UI strings are Arabic; numeric inputs use LTR direction (`dir="ltr"` on the input).
6. **Permissions** live in `packages/shared/src/constants/permissions.ts` — single source of truth for backend `@RequirePermission`, Prisma seed, and frontend `<PermissionGate>`. **181 codes across 19 modules** as of today.
7. **JWT**: 15 min access (in memory) + 7 d refresh (httpOnly cookie) + 30 d remember-me. Lockout: 5 attempts / 15 min → 429 with `Retry-After`.
8. **Idempotency-Key** middleware on every mutation. Auto-injected client-side from `apps/web/src/lib/http.ts`.
9. **Soft-delete** via `deletedAt` for users, customers, suppliers, etc. Never hard-delete.
10. **Audit log table exists but is not yet emitted to** — fixing this is a separate cleanup PR (open question in `PROJECT_STATUS.md`).

---

## 5. Daily commands you will actually use

```bash
# Bootstrap on a fresh clone (in this exact order)
nvm use                                        # → 20
corepack enable && corepack prepare pnpm@9.15.9 --activate
pnpm install                                   # ≈ 23 s
pnpm db:generate                               # generate Prisma client (no DB needed)
pnpm --filter @grocery/shared build            # REQUIRED before recursive typecheck

# Inner loop
pnpm lint                                      # Biome (no autofix)
pnpm lint:fix                                  # Biome safe autofix
pnpm typecheck                                 # tsc --noEmit, all packages
pnpm test                                      # 231 tests today
pnpm --filter @grocery/web test -- --run       # web only (28 s)
pnpm --filter @grocery/api test                # api only (8 s)
pnpm --filter @grocery/shared test             # shared only (2 s)

# Database (only when PostgreSQL is available — NOT in sandbox)
pnpm db:migrate                                # prisma migrate dev
pnpm db:seed                                   # 6 roles, 181 permissions, owner user
pnpm db:studio                                 # Prisma Studio

# Dev servers (only when DB is up)
pnpm dev                                       # web :5173 + api :3001
```

---

## 6. Repository tour — where things live

```
grocery-system/
├── apps/
│   ├── api/                          NestJS 10
│   │   └── src/
│   │       ├── common/               filters, interceptors, pipes, middleware
│   │       ├── modules/
│   │       │   ├── auth/             ✅ Phase 2
│   │       │   ├── users/            ✅ Phase 2
│   │       │   ├── roles/            ✅ Phase 2
│   │       │   ├── permissions/      ✅ Phase 2
│   │       │   ├── customers/        ✅ Phase 3 (← copy this for Phase 4!)
│   │       │   ├── notifications/    ✅ Phase 3
│   │       │   └── health/           ✅ Phase 1
│   │       └── main.ts               bootstrap (port 3001, prefix /api/v1)
│   │
│   └── web/                          React 18 + Vite 5 + Ionic 8
│       └── src/
│           ├── components/
│           │   ├── ui/               13 primitives (Button, Card, Modal, …)
│           │   ├── layout/           AppShell, PageHeader, Breadcrumbs, BottomNav, Sidebar
│           │   ├── dashboard/        KPI cards
│           │   ├── permissions/      <PermissionGate>, <PermissionsEditor>
│           │   ├── customers/        ✅ Phase 3 (← copy this for Phase 4!)
│           │   └── notifications/    ✅ Phase 3 NotificationBell
│           ├── pages/
│           │   ├── LoginPage / DashboardPage / AccountPage / NotFoundPage
│           │   ├── admin/            users, roles
│           │   ├── customers/        ✅ Phase 3
│           │   └── notifications/    ✅ Phase 3
│           ├── lib/
│           │   ├── http.ts           axios instance + Idempotency-Key + 401 retry
│           │   ├── api.ts            apiGet/apiPost/apiPatch/apiDelete helpers
│           │   ├── api/              per-domain clients (customers.ts, notifications.ts)
│           │   ├── whatsapp.ts       deep-link generator + 3 templates
│           │   ├── cn.ts             clsx-like
│           │   └── queryClient.ts    TanStack Query defaults
│           └── stores/
│               └── authStore.ts      zustand: user, accessToken, hasPermission, …
│
├── packages/shared/                   types, schemas, constants
│   └── src/
│       ├── constants/
│       │   ├── permissions.ts        ⭐ 181 codes (single source of truth)
│       │   └── roles.ts              6 system roles
│       ├── schemas/                  Zod input/output schemas (auth, users, roles, customers, …)
│       └── types/                    cross-package TS types
│
├── prisma/
│   ├── schema.prisma                 14 models today
│   ├── migrations/                   2 migrations (init_phase2_auth, p3_customers_notifications)
│   ├── seed.ts                       6 roles, 181 permissions, 1 owner user
│   └── seed-test-users.ts            one user per role for smoke tests
│
├── docs/                             ⭐ READ FIRST: AGENT_HANDOFF.md, PROJECT_STATUS.md, 12-agent-memory.md
│   ├── 00..13-*.md                   target spec (not implementation reality)
│   ├── phase2/                       Phase-2 manual tests, curl outputs, screenshots
│   └── legacy/                       archived schemas
│
├── knowledge-base/                   ⭐ 11-file audit (2026-05-02)
├── scripts/                          Lighthouse + screenshot Puppeteer scripts
├── biome.json / tsconfig.base.json   root configs
└── README.md / DEVELOPMENT.md        public-facing entry points
```

---

## 7. Phase 4 — what to do next (concrete instructions)

### 7.1 Branch & PR
```bash
git checkout genspark_ai_developer
git pull --ff-only origin genspark_ai_developer
git checkout -b phase4_suppliers_purchases
```
Open the PR against `genspark_ai_developer` (NOT `main`).

### 7.2 Acceptance criteria (Definition of Done)
- ✅ Prisma migration `<timestamp>_p4_suppliers_purchases` adds: `Supplier`, `SupplierTransaction`, `Purchase`, `PurchaseItem`.
- ✅ Backend modules: `suppliers/`, `supplier-transactions/`, `purchases/` — each with controller, service, module, DTOs, Zod schemas.
- ✅ All mutations atomic via `prisma.$transaction(async (tx) => …)`. Use `SELECT FOR UPDATE` semantics on the supplier row.
- ✅ **Cash purchase** path: creates `Purchase` row only, **no** balance change.
- ✅ **Credit purchase** path: atomically creates `Purchase` + `SupplierTransaction(CREDIT_PURCHASE)` + updates `Supplier.currentBalance`.
- ✅ **Cancel** of credit purchase: reverses balance atomically; cancel of cash purchase: balance untouched.
- ✅ Frozen / inactive supplier blocked from new credit purchases (Arabic error code).
- ✅ Frontend pages: `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/suppliers/:id/edit`, `/suppliers/:id/statement`, `/purchases`, `/purchases/new`, `/purchases/:id`.
- ✅ Sidebar + BottomNav updated to expose Suppliers + Purchases (and the missing Customers + Notifications nav items from Phase 3 — see open question §1 in `PROJECT_STATUS.md`).
- ✅ ≥ 30 new tests covering the four cash/credit invariants, cancel reversal, frozen-guard, pagination, and search.
- ✅ `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` ≥ 261 (231 + 30) and all green.
- ✅ Update `PROJECT_STATUS.md` Phase-4 section to "✅ done".
- ✅ Commit message: `feat(p4): suppliers + supplier-transactions + purchases (cash + credit)`.
- ✅ PR description includes: schema diff, list of new endpoints with sample bodies, list of new permissions guarded, test count delta, and a "deferred" section listing items requiring live PostgreSQL.

### 7.3 What you can copy verbatim
- **Service skeleton**: `apps/api/src/modules/customers/customers.service.ts` (~330 LOC) → adapt to `SuppliersService`.
- **Atomic transaction pattern**: `apps/api/src/modules/customers/customer-transactions.service.ts` `createDebt` and `cancel` methods.
- **Module pattern**: `apps/api/src/modules/customers/customers.module.ts`.
- **Frontend list page**: `apps/web/src/pages/customers/CustomersListPage.tsx` (debounced search, status filter, pagination).
- **Frontend detail page**: `apps/web/src/pages/customers/CustomerDetailPage.tsx`.
- **Modal pattern**: `apps/web/src/components/customers/AddDebtModal.tsx`.
- **Backend test pattern**: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (94 % coverage).
- **Frontend test pattern**: `apps/web/src/components/customers/__tests__/BalanceDisplay.test.tsx`.

### 7.4 What you must NOT do
- ❌ Don't run `pnpm db:migrate` here (no PostgreSQL). Hand-write the SQL.
- ❌ Don't change any of the 14 existing models, the 181 permission codes, the 6 system roles, or the auth flow.
- ❌ Don't introduce ESLint, Prettier, or any linter other than Biome.
- ❌ Don't downgrade Ionic, React, or React-Router.
- ❌ Don't add UI strings in English (Arabic only; logs/comments may be English).
- ❌ Don't deploy to Railway (that's Phase 10).
- ❌ Don't hard-delete anything.
- ❌ Don't create a `Product` / `StockMovement` model (that's Phase 9). `PurchaseItem.productId` stays nullable until then.

---

## 8. Workflow expectations every commit must follow

1. **Make change** → run `pnpm lint && pnpm typecheck && pnpm test`.
2. **All green?** → `git add -p` (review every hunk) → conventional commit message.
3. **Push** → branch must be on `origin`.
4. **Open / update PR** → target `genspark_ai_developer`, not `main`.
5. **Provide PR URL to the user** in your reply.
6. **Update `PROJECT_STATUS.md`** in the same PR if the phase status changes.

If any step fails, **stop and report**. Do not push broken code in the hope of fixing it in a follow-up.

---

## 9. Common pitfalls in this repo (learned the hard way)

1. **AppShell requires `title` (string)**. Don't pass `breadcrumbs={[…]}`; use `<PageHeader eyebrow={<Breadcrumbs items=… />}>` instead.
2. **BreadcrumbItem uses `to`, not `href`**.
3. **Biome flags `as any` and `Array.from({length}, …)` keys**. Use typed casts and stable string keys (e.g., `['n0','n1',…]`).
4. **`pnpm typecheck` from a clean clone**: build `@grocery/shared` first, otherwise `tsc` can't resolve it.
5. **NavLink imports from `react-router-dom@5`**, not `@6`. The shape of the API differs.
6. **Tailwind RTL**: `me-2` is "margin-end" (RTL = left, LTR = right). Don't use `mr-2` for trailing-space.
7. **`Idempotency-Key` is auto-injected by `lib/http.ts`** — backend tests must include it in headers when simulating requests.
8. **`framer-motion` re-renders on route change** in Ionic 8 — wrap in a `<PageTransition>` or use `key={pathname}` carefully.

---

## 10. Glossary (for the agent that's never seen Arabic)

| Arabic | Transliteration | English |
|--------|-----------------|---------|
| العملاء | al-`umalā' | Customers |
| الموردون | al-mawarridūn | Suppliers |
| المشتريات | al-mushtarayāt | Purchases |
| المبيعات | al-mabī`āt | Sales |
| المصروفات | al-maṣrūfāt | Expenses |
| الإيراد اليومي | al-īrād al-yawmī | Daily Income |
| التقارير | at-taqārīr | Reports |
| الإشعارات | al-ish`ārāt | Notifications |
| الديون | ad-duyūn | Debts |
| الرصيد | ar-raṣīd | Balance |
| الحالة | al-ḥāla | Status |
| نشط / مجمد | nashiṭ / mujammad | Active / Frozen |
| كشف الحساب | kashf al-ḥisāb | Account statement |
| نقد / آجل | naqd / ājil | Cash / Credit |

You don't need to translate UI strings in code — they are already in Arabic in `apps/web/src/i18n/ar.ts` and inline in components. Just don't break them.

---

## 11. When in doubt

1. Read [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — it has truthful per-phase status.
2. Read [`12-agent-memory.md`](./12-agent-memory.md) — locked decisions.
3. Search [`../knowledge-base/`](../knowledge-base/) — 11 files, 1,600 lines of audit material.
4. Open a PR question for the user — better than guessing and merging wrong.

> **A wrong assumption merged into `genspark_ai_developer` is more expensive than ten "are you sure?" questions in a PR thread.**

---

End of handoff. Good luck with Phase 4. 🚀
