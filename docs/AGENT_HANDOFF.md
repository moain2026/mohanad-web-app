# AGENT_HANDOFF.md — Onboarding for the Next Session

> **Purpose**: this file is the **first thing** a new AI agent (or human
> developer) reads before touching the code. Treat it as a 10-minute safety
> briefing.
>
> **Last updated**: 2026-05-20 (post-Phase-4 merge + maintenance PR).
>
> **Companion files**:
> - [`MASTER_PLAN.md`](./MASTER_PLAN.md) — current PR's "contract" + repo analysis.
> - [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — granular per-phase reality.
> - [`12-agent-memory.md`](./12-agent-memory.md) — locked product decisions
>   (do not modify without explicit user approval).
> - [`../knowledge-base/`](../knowledge-base/) — 11-file audit folder
>   generated 2026-05-02.
> - [`../README.md`](../README.md) — public-facing summary + roadmap.
> - [`../DEVELOPMENT.md`](../DEVELOPMENT.md) — daily commands cheatsheet.

---

## 0. Identity check

You are working on **Grocery System (نظام إدارة البقالة)** — a bilingual
(Arabic-first RTL) PWA for managing a small-to-medium grocery store. The
product is described in detail in `docs/00-project-overview.md`. Do **not**
assume English UI; the entire product is Arabic.

**Repo:** `https://github.com/moain2026/mohanad-web-app`
**Integration branch:** `genspark_ai_developer`
**License:** proprietary.

---

## 1. The single most important rule

> **Implementation reality > spec docs.**
>
> When the implementation (`apps/api/src/modules/`, `apps/web/src/pages/`,
> `prisma/schema.prisma`) and any document under `docs/00..13-*.md` disagree,
> **the implementation wins**, and you must NOT silently change the
> implementation to match a spec doc. Open a question with the user first.

The only docs that are **authoritative for current state** are:
1. This file (`AGENT_HANDOFF.md`).
2. [`MASTER_PLAN.md`](./MASTER_PLAN.md) (current PR contract).
3. [`PROJECT_STATUS.md`](./PROJECT_STATUS.md).
4. [`12-agent-memory.md`](./12-agent-memory.md) (locked decisions).
5. [`../knowledge-base/`](../knowledge-base/).

Everything else (00–13 numbered docs) describes the **target design** and is
allowed to be ahead of the code.

---

## 2. What is shipped today (TL;DR)

| Phase  | Title                                                                 | Status | PR        |
| -----: | --------------------------------------------------------------------- | :----: | --------- |
| 0      | Documentation (00–13 + memory + master_plan)                          | ✅     | n/a       |
| 1      | Foundation (monorepo, schema, design system, PWA scaffold)            | ✅     | #2 / #3   |
| 2      | Auth + RBAC (181 permissions, admin UI, account, idempotency)         | ✅     | #4 / #5   |
| 3      | Customers + Debts + WhatsApp deep-links + Notifications UI            | ✅     | #6        |
| 4      | Suppliers + Purchases (cash + credit)                                 | ✅     | #8        |
| 5      | Expenses + Daily Income                                               | ❌ **next** | —     |
| 6      | Sales (3 modes)                                                       | ❌     | —         |
| 7      | Reports (11 types)                                                    | ❌     | —         |
| 8      | Notifications-advanced + cron + templates                             | ❌     | —         |
| 9      | Inventory (optional)                                                  | ❌     | —         |
| 10     | Polish + PWA + Railway deploy + E2E                                   | ❌     | —         |

**Tests passing**: 336 / 336 → shared 97 + api 116 + web 123.

The granular per-module breakdown is in `PROJECT_STATUS.md`
§ "Phase-by-phase reality".

---

## 3. Sandbox limits — before you estimate anything, read this

The genspark sandbox where most agent work happens has **hard** constraints.
Estimating timelines without acknowledging them produces unrealistic plans.

| Limit                                                                  | Symptom                                                                                  | Mitigation                                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ❌ **No PostgreSQL service**                                            | `prisma migrate dev` cannot run. The API cannot start end-to-end. No live `curl` evidence. No live screenshots. | Hand-write migration SQL into `prisma/migrations/<timestamp>_<name>/migration.sql`. Use **mocked Prisma** in unit tests. Defer live evidence to Railway (Phase 10). |
| ⏱ **`pnpm build` (full monorepo) > 240 s**                              | The `Bash` tool times out.                                                               | Build per-package: `pnpm --filter @grocery/shared build`, etc. Production builds run on Railway.                                                          |
| ❌ **No headless browser**                                              | Playwright cannot run. No real screenshots.                                              | Document expected screenshots; defer real captures to Phase 10.                                                                                            |
| ⚠ **`pnpm typecheck` fails on clean clone**                             | `tsc` looks for `@grocery/shared` in `dist/`, not `src/`.                                | **Always** run `pnpm --filter @grocery/shared build` first.                                                                                                |
| 🐢 **`pnpm install` ≈ 23 s**                                            | Heavy deps (Ionic, framer-motion, lucide).                                               | Don't call it in a tight loop.                                                                                                                             |
| ⚠ **`pnpm` is not in PATH on a fresh sandbox**                          | Commands fail with "pnpm: command not found".                                            | `npm config set prefix "$HOME/.npm-global" && npm i -g pnpm@9.15.9 && export PATH="$HOME/.npm-global/bin:$PATH"`.                                          |

**Rule:** if a phase's DoD requires a live database, real screenshots, or a
passing E2E flow, it cannot be **fully** completed from the sandbox. Deliver
everything that can be delivered (schema, code, mocked tests, docs) and mark
the deferred items in the PR description.

---

## 4. Locked decisions (recap — full list in `12-agent-memory.md`)

These are baked into the codebase. **Do not change them** without explicit
user approval.

1. **Money columns** = `Decimal(14, 2)` (Prisma) → strings on the wire → never
   `Number()` for arithmetic.
2. **Ionic 8** is the UI shell, which **locks React-Router to v5**.
3. **Biome 1.9.4** is the only lint/format tool.
4. **pnpm 9.15.9** is the only package manager. Lockfile is canonical.
5. **Tailwind RTL plugin** is mandatory. Arabic UI strings; numeric inputs LTR.
6. **Permissions** in `packages/shared/src/constants/permissions.ts` — **181
   codes across 19 modules**.
7. **JWT**: 15 min access + 7 d refresh + 30 d remember-me. Lockout 5 / 15 min.
8. **Idempotency-Key** middleware on every mutation.
9. **Soft-delete** via `deletedAt`. Never hard-delete financial records.
10. **AuditLog**: now actively written by customer/supplier/purchase services
    (closed in the 2026-05-20 maintenance PR).

---

## 5. Daily commands you will actually use

```bash
# Bootstrap on a fresh clone (in this exact order)
nvm use                                        # → 20
corepack enable && corepack prepare pnpm@9.15.9 --activate
# If corepack fails (sandbox):
npm config set prefix "$HOME/.npm-global"
npm install -g pnpm@9.15.9
export PATH="$HOME/.npm-global/bin:$PATH"

pnpm install                                   # ≈ 23 s
pnpm db:generate                               # generate Prisma client (no DB needed)
pnpm --filter @grocery/shared build            # REQUIRED before recursive typecheck

# Inner loop
pnpm lint                                      # Biome
pnpm lint:fix                                  # Biome safe autofix
pnpm typecheck                                 # tsc --noEmit, all packages
pnpm test                                      # 336 tests today
pnpm --filter @grocery/web exec vitest run     # web only (28 s)
pnpm --filter @grocery/api test                # api only (8 s)
pnpm --filter @grocery/shared exec vitest run  # shared only (2 s)

# Maintenance (added 2026-05-20)
pnpm --filter @grocery/api purge:idempotency   # delete expired Idempotency-Key rows

# Database (only when PostgreSQL is available — NOT in sandbox)
pnpm db:migrate
pnpm db:seed
pnpm db:studio

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
│   │       ├── common/
│   │       │   ├── audit/            ⭐ writeAuditLog helper (2026-05-20)
│   │       │   └── middleware/       idempotency middleware + cleaner
│   │       ├── modules/
│   │       │   ├── auth/             ✅ Phase 2 — incl. sessions endpoints (2026-05-20)
│   │       │   ├── users/            ✅ Phase 2
│   │       │   ├── roles/            ✅ Phase 2
│   │       │   ├── permissions/      ✅ Phase 2
│   │       │   ├── customers/        ✅ Phase 3
│   │       │   ├── notifications/    ✅ Phase 3
│   │       │   ├── suppliers/        ✅ Phase 4
│   │       │   ├── purchases/        ✅ Phase 4
│   │       │   └── health/           ✅ Phase 1
│   │       └── main.ts               bootstrap (port 3001, prefix /api/v1)
│   │
│   └── web/                          React 18 + Vite 5 + Ionic 8
│       └── src/
│           ├── components/
│           │   ├── ui/               13 primitives
│           │   ├── layout/           AppShell, BottomNav, Sidebar (notifications + suppliers wired 2026-05-20)
│           │   ├── account/          ⭐ SessionsList (2026-05-20)
│           │   ├── customers/        ✅ Phase 3
│           │   ├── notifications/    ✅ Phase 3
│           │   ├── suppliers/        ✅ Phase 4
│           │   └── purchases/        ✅ Phase 4
│           ├── pages/
│           │   ├── LoginPage / DashboardPage / AccountPage / NotFoundPage
│           │   ├── admin/            users, roles
│           │   ├── customers/        ✅ Phase 3
│           │   ├── notifications/    ✅ Phase 3
│           │   ├── suppliers/        ✅ Phase 4
│           │   └── purchases/        ✅ Phase 4
│           ├── lib/
│           │   ├── http.ts           axios + Idempotency-Key + 401 retry
│           │   ├── api/              per-domain clients
│           │   ├── whatsapp.ts       deep-link generator + 3 templates
│           │   └── queryClient.ts    TanStack Query defaults
│           └── stores/
│               └── authStore.ts      zustand: user, accessToken, hasPermission
│
├── packages/shared/                   types, schemas, constants
├── prisma/
│   ├── schema.prisma                 18 models today
│   ├── migrations/                   3 migrations
│   ├── seed.ts                       6 roles, 181 permissions, owner user
│   └── seed-test-users.ts            one user per role
│
├── docs/                             ⭐ READ FIRST: AGENT_HANDOFF / MASTER_PLAN / PROJECT_STATUS / 12-agent-memory
├── knowledge-base/                   ⭐ 11-file audit (2026-05-02)
├── scripts/                          Lighthouse + screenshot Puppeteer scripts
└── README.md / DEVELOPMENT.md        public-facing entry points
```

---

## 7. Phase 5 — what to do next (concrete instructions)

### 7.1 Branch & PR
```bash
git checkout genspark_ai_developer
git pull --ff-only origin genspark_ai_developer
git checkout -b phase5_expenses_daily_income
```
Open the PR against `genspark_ai_developer` (NOT `main`).

### 7.2 Acceptance criteria (Definition of Done)
- ✅ Prisma migration `<timestamp>_p5_expenses_daily_income` adds:
  `ExpenseCategory`, `Expense`, `DailyIncome`.
- ✅ Backend module `expenses/`:
  - Create paths:
    - `NORMAL` expense → records to `Expense` only.
    - `SUPPLIER_PAYMENT` → also calls `SuppliersService.createPayment` to
      decrement supplier balance (one atomic transaction).
    - `CASH_PURCHASE_LINK` → references an existing `Purchase` and does NOT
      double-count (no new financial ledger entry beyond the existing
      `Purchase` row).
  - Cancel: reverses any side effects atomically.
- ✅ Backend module `daily-income/`:
  - One row per (storeId, date) — unique index.
  - Aggregates: cash sales, cash purchases, expenses, opening cash.
  - Endpoints: list/history, today, close-day (locks the row).
- ✅ Frontend pages: `/expenses`, `/expenses/new`, `/daily-income`,
  `/daily-income/history`.
- ✅ `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` all green
  (target ≥ 380 tests = 336 + ~45 new).
- ✅ Update `PROJECT_STATUS.md` Phase-5 section to "✅ done".
- ✅ Commit message: `feat(p5): expenses + daily-income with supplier-payment + cash-purchase-link paths`.

### 7.3 What you can copy verbatim
- **Service skeleton**: `apps/api/src/modules/customers/customers.service.ts`.
- **Two-path service**: `apps/api/src/modules/purchases/purchases.service.ts`.
- **Atomic cross-module call**: `customer-transactions.service.ts`
  `createDebt` shows how to coordinate a parent transaction with a child
  ledger write — reuse for `SUPPLIER_PAYMENT`.

### 7.4 What you must NOT do
- ❌ Don't run `pnpm db:migrate` here (no PostgreSQL). Hand-write the SQL.
- ❌ Don't change any of the 18 existing models, the 181 permission codes,
  the 6 system roles, or the auth flow.
- ❌ Don't double-count cash purchases. `CASH_PURCHASE_LINK` MUST reference
  an existing `Purchase.id` and emit zero financial side effects.
- ❌ Don't introduce ESLint, Prettier, or any linter other than Biome.
- ❌ Don't add UI strings in English.
- ❌ Don't deploy to Railway (Phase 10).

---

## 8. Workflow expectations every commit must follow

1. **Make change** → run `pnpm lint && pnpm typecheck && pnpm test`.
2. **All green?** → `git add -p` → conventional commit message.
3. **Push** → branch must be on `origin`.
4. **Open / update PR** → target `genspark_ai_developer`, not `main`.
5. **Provide PR URL** to the user in your reply.
6. **Update `PROJECT_STATUS.md`** in the same PR if the phase status changes.

If any step fails, **stop and report**. Do not push broken code in the hope of
fixing it in a follow-up.

---

## 9. Common pitfalls in this repo (learned the hard way)

1. **AppShell requires `title` (string)**. Don't pass `breadcrumbs=[…]`; use
   `<PageHeader eyebrow={<Breadcrumbs items=…/>}>` instead.
2. **BreadcrumbItem uses `to`, not `href`**.
3. **Biome flags `as any` and array-index keys**. Use typed casts and stable
   string keys.
4. **`pnpm typecheck` from a clean clone**: build `@grocery/shared` first.
5. **NavLink imports from `react-router-dom@5`**, not `@6`.
6. **Tailwind RTL**: `me-2` is "margin-end" (RTL = left, LTR = right).
7. **`Idempotency-Key` is auto-injected by `lib/http.ts`** — backend tests
   must include it in headers when simulating requests.
8. **`framer-motion` re-renders on route change** in Ionic 8 — wrap in a
   `<PageTransition>` or use `key={pathname}` carefully.
9. **AuditLog now expects every mutation to call `writeAuditLog`** — when
   adding a new service in Phase 5, follow the pattern in
   `customers.service.ts`.

---

## 10. Glossary (for the agent that's never seen Arabic)

| Arabic           | Transliteration       | English             |
| ---------------- | --------------------- | ------------------- |
| العملاء          | al-ʿumalāʾ            | Customers           |
| الموردون         | al-mawarridūn         | Suppliers           |
| المشتريات        | al-mushtarayāt        | Purchases           |
| المبيعات         | al-mabīʿāt            | Sales               |
| المصروفات        | al-maṣrūfāt           | Expenses            |
| الإيراد اليومي   | al-īrād al-yawmī      | Daily Income        |
| التقارير         | at-taqārīr            | Reports             |
| الإشعارات        | al-ishʿārāt           | Notifications       |
| الديون           | ad-duyūn              | Debts               |
| الرصيد           | ar-raṣīd              | Balance             |
| الحالة           | al-ḥāla               | Status              |
| نشط / مجمد       | nashiṭ / mujammad     | Active / Frozen     |
| كشف الحساب       | kashf al-ḥisāb        | Account statement   |
| نقد / آجل        | naqd / ājil           | Cash / Credit       |
| جلسة             | jalsa                 | Session             |

You don't need to translate UI strings in code — they are already in Arabic
in `apps/web/src/i18n/ar.ts` and inline in components. Just don't break them.

---

## 11. When in doubt

1. Read [`MASTER_PLAN.md`](./MASTER_PLAN.md) and
   [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — truthful state.
2. Read [`12-agent-memory.md`](./12-agent-memory.md) — locked decisions.
3. Search [`../knowledge-base/`](../knowledge-base/) — 11 files of audit material.
4. Open a PR question for the user — better than guessing and merging wrong.

> **A wrong assumption merged into `genspark_ai_developer` is more expensive
> than ten "are you sure?" questions in a PR thread.**

---

End of handoff. Good luck with Phase 5. 🚀
