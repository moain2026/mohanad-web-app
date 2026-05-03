# 02 — القرارات المُقفلة (Locked Decisions)

> ⚠️ مأخوذة من `docs/12-agent-memory.md`. **لا يجوز مخالفتها**.

## القرارات التقنية الثابتة

| البند | القرار |
|---|---|
| نوع التطبيق | PWA أونلاين عربي (RTL) — multi-worker |
| Frontend | React + TS + Vite + Ionic React + Tailwind |
| Backend | NestJS + TypeScript |
| Database | **Railway PostgreSQL فقط** |
| ORM | Prisma + cuid() built-in IDs |
| Architecture | Monorepo pnpm workspaces (لا Turborepo) |
| Router | **React‑Router v5** (مقفول بـ Ionic 8) |
| Auth | JWT Access (15 min) + Refresh httpOnly cookie (7d / 30d Remember Me) |
| Hashing | bcrypt rounds=12 |
| Decimal | `Decimal @db.Decimal(14, 2)` |

## القواعد الذهبية (10 — لا تُكسر)

1. ✋ **لا حذف نهائي للعمليات المالية** — فقط `cancelledAt` أو `deletedAt`
2. 🛡️ **كل العمليات المالية** تمر عبر الباكند داخل `prisma.$transaction`
3. 📜 **كل عملية حساسة تُسجَّل في `audit_logs`** (مع old_values & new_values)
4. 👁️ **الواجهة تخفي/تظهر** حسب الصلاحيات — تحسين UX فقط
5. 🔐 **الباكند يتحقق من الصلاحيات** في كل API (PermissionGuard)
6. 🔒 **`SELECT … FOR UPDATE`** إلزامي على `customer.currentBalance` و `supplier.currentBalance`
7. 🚫 **الفرونت لا يحدّث الأرصدة** أبداً
8. 📊 **التقارير: 3 صلاحيات منفصلة** — view / print / export
9. 🆔 **`Idempotency-Key` header إلزامي** على POST لـ /sales, /customer-transactions, /supplier-transactions, /expenses, /purchases
10. 🗃️ **Railway PostgreSQL فقط**

## القاعدة المحاسبية المعتمدة

```text
- شراء آجل  →  purchase + supplier_transaction (دين+)
- شراء نقدي →  purchase فقط (ينقص النقد في Cash Flow، لا expense منفصل)
- دفع لمورد →  expense(type=supplier_payment) + supplier_transaction (دين-)
- خرج عادي →  expense(type=normal) فقط
```

## Design System

- **Primary Color**: `#059669` (Emerald-600)
- **Font Sans**: IBM Plex Sans Arabic Variable (self-hosted)
- **Font Mono**: JetBrains Mono Variable (للأرقام، tabular-nums)
- **Numerals**: إنجليزية 0-9 قاطعاً
- **Breakpoint**: 768px (Modal ↔ BottomSheet)
- **Animation curves**:
  - `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out
  - `cubic-bezier(0.34, 1.56, 0.64, 1)` — overshoot / pop
  - Stagger: 60ms between siblings

## Bottom Tabs by Role

```typescript
const BOTTOM_TABS_BY_ROLE = {
  sales_worker:      ['home', 'sales', 'customers', 'debts', 'more'],
  manager:           ['home', 'sales', 'reports', 'notifications', 'more'],
  accountant:        ['home', 'reports', 'customers', 'suppliers', 'more'],
  inventory_officer: ['home', 'products', 'inventory', 'purchases', 'more'],
  owner:             ['home', 'sales', 'reports', 'notifications', 'more'],
};
```

## Idempotency

- **TTL**: 24h
- **Cache**: only 2xx responses
- **Replay header**: `Idempotent-Replay: true`
- **Conflict**: 409 `IDEMPOTENCY_KEY_CONFLICT`

## Pagination Shape

```typescript
{ items: [...], meta: { page, limit, total, totalPages } }
// (totalPages can be computed client-side)
```

## Naming Conventions

| الموضوع | الصيغة |
|---|---|
| Permission code | `customer_transactions.create_debt` (snake.dot) |
| API path | `/customer-transactions/debt` (kebab) |
| DB tables/columns | `customer_transactions`, `current_balance` (snake) |
| Prisma model fields | camelCase + `@map("snake_case")` |
| TS types/classes | PascalCase |
| TS variables/functions | camelCase |
| React components | PascalCase |
| Component files | PascalCase (`AppButton.tsx`) |
| API files | kebab-case |

## Conflicts النهائية

| # | الموضوع | القرار |
|---|---|---|
| C#1 | Service Worker | مرحلة 10 فقط، static assets only |
| C#2 | Cash Purchase | **purchase فقط بدون expense** |
| C#3 | daily_summary | منفصل في `daily_incomes` (يُحذف من sales.sale_mode enum) |
| C#4 | Permission Refresh | ينتظر refresh الـ token (حتى 15 دقيقة) |
| C#5 | Mixed Payment | مؤجل لـ v2 (cash | credit فقط) |

## v1 Scope (المعتمد)

✅ Auth, RBAC, Users, Roles, Permissions
✅ Customers + opening balance + رصيد سالب مسموح + badge أزرق
✅ Customer Transactions (debt/payment/adjustment/clearance + cancel)
✅ Sales (detailed/quick، cash/credit فقط)
✅ Daily Income (منفصل عن sales)
✅ Suppliers + opening balance + Supplier Transactions
✅ Purchases (total_only/detailed، cash/credit) — Cash purchase: purchase فقط
✅ Expenses (normal/supplier_payment)
✅ Reports + Notifications + WhatsApp button (يدوي)
✅ Audit Logs (لا يُحذف)
✅ PWA (SW في مرحلة 10 فقط)

## v2 Deferred

❌ Dark Mode, Multi-currency فعلي, Multi-tenant UI
❌ Approval Workflow Table, constraints_json logic
❌ Mixed payment, Offline financial ops, WhatsApp API automatic
❌ Native apps, Images, E-payment, Hardware integrations
❌ BullMQ/Redis, Turborepo, react-i18next, PDF backend
