# Grocery System (نظام إدارة البقالة)

[![Node](https://img.shields.io/badge/node-%3E%3D20.10-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9.0-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/lint-Biome%201.9-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#الترخيص)

> نظام إدارة بقالة أونلاين متكامل (PWA) — عربي بالكامل (RTL)
> Stack: **React + TS + Vite + Ionic + Tailwind** | **NestJS + TypeScript** | **Prisma + Railway PostgreSQL**
> Lint/format: **Biome** (replaces ESLint + Prettier).

## الحالة الحالية

> **آخر تحديث**: 2026-05-20 — الـ source of truth الموثوق:
> [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) و
> [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md).

| المرحلة | الوصف                                          | الحالة          |
| ------- | ---------------------------------------------- | --------------- |
| 0       | التحليل والتوثيق                               | ✅ مكتمل        |
| 1       | Foundation (Monorepo + Schema + Shells)        | ✅ مكتمل        |
| 2       | Auth + RBAC (181 permissions, 6 roles)         | ✅ مكتمل        |
| 3       | Customers + Debts + Notifications + WhatsApp   | ✅ مكتمل        |
| 4       | Suppliers + Purchases (Cash + Credit)          | ✅ مكتمل        |
| **5**   | **Expenses + Daily Income**                    | ⏳ **التالي**   |
| 6       | Sales Modes                                    | ⏳              |
| 7       | Reports                                        | ⏳              |
| 8       | Notifications-advanced + Cron + Templates      | ⏳              |
| 9       | Inventory (optional)                           | ⏳              |
| 10      | Polish + PWA + Deployment + E2E                | ⏳              |

**اختبارات اليوم**: 336 / 336 خضراء (shared 97 · api 116 · web 123).
**Prisma models**: 18 · **Migrations**: 3 · **Permissions**: 181 / 19 modules.

## بنية المشروع (Monorepo — pnpm workspaces)

```
grocery-system/
├── apps/
│   ├── api/          # NestJS backend (REST + Prisma + JWT + RBAC)
│   └── web/          # React PWA (Vite + Ionic + Tailwind + RTL)
├── packages/
│   └── shared/       # types, zod schemas, PERMISSIONS, constants
├── prisma/           # schema + seed (root-level — Q5 of recovery)
├── docs/             # 13 ملف توثيق معتمد + recovery report
├── biome.json
├── tsconfig.base.json
└── package.json
```

## المتطلبات

- Node.js **>= 20.10.0**
- pnpm **>= 9.0.0**
- PostgreSQL **>= 14** (محلياً للتطوير، Railway للإنتاج)

## البدء السريع

```bash
# 1. تثبيت الاعتماديات
pnpm install

# 2. إعداد متغيرات البيئة
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env

# 3. (Phase 2 onward) إنشاء قاعدة البيانات وتشغيل seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. تشغيل dev servers (api على 3001، web على 5173)
pnpm dev
```

> Foundation phase ships without migrations — `prisma migrate dev` runs in Phase 2.
> See `DEVELOPMENT.md` for detailed onboarding.

## السكربتات الجذرية

| السكربت           | الوصف                                       |
| ----------------- | ------------------------------------------- |
| `pnpm dev`        | تشغيل web + api بالتوازي                   |
| `pnpm dev:api`    | تشغيل الباكند فقط                           |
| `pnpm dev:web`    | تشغيل الفرونت فقط                           |
| `pnpm build`      | بناء الإنتاج لجميع الحزم                    |
| `pnpm lint`       | فحص Biome                                   |
| `pnpm lint:fix`   | إصلاحات Biome الآمنة                       |
| `pnpm format`     | تنسيق Biome                                 |
| `pnpm typecheck`  | فحص الأنواع                                 |
| `pnpm test`       | تشغيل الاختبارات (Vitest + Jest)           |
| `pnpm db:migrate` | تشغيل migrations                            |
| `pnpm db:seed`    | seed بيانات الصلاحيات والأدوار والمالك      |
| `pnpm db:studio`  | فتح Prisma Studio                           |
| `pnpm lh`         | Lighthouse audit (JSON + screenshots)       |

## التوثيق

> **اقرأ أولاً** (Source of Truth الحالي):
> - [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md) — 10 دقائق onboarding للجلسة الجديدة
> - [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) — حالة كل مرحلة بدقّة
> - [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) — خطّة الـ PR الحالي
> - [`docs/12-agent-memory.md`](./docs/12-agent-memory.md) — القرارات المُقفلة

راجع مجلد [`docs/`](./docs) للتوثيق التصميمي الكامل:

- [`00-project-overview.md`](./docs/00-project-overview.md)
- [`01-requirements-analysis.md`](./docs/01-requirements-analysis.md)
- [`02-architecture.md`](./docs/02-architecture.md)
- [`03-database-design.md`](./docs/03-database-design.md)
- [`04-rbac-permissions.md`](./docs/04-rbac-permissions.md)
- [`05-ui-ux-guidelines.md`](./docs/05-ui-ux-guidelines.md)
- [`06-modules.md`](./docs/06-modules.md)
- [`07-api-plan.md`](./docs/07-api-plan.md)
- [`08-reports.md`](./docs/08-reports.md)
- [`09-notifications.md`](./docs/09-notifications.md)
- [`10-security-and-audit.md`](./docs/10-security-and-audit.md)
- [`11-development-roadmap.md`](./docs/11-development-roadmap.md)
- [`12-agent-memory.md`](./docs/12-agent-memory.md) ← **القرارات الثابتة**
- [`recovery-report.md`](./docs/recovery-report.md) ← Foundation Recovery PR

## الترخيص

Private — proprietary.
