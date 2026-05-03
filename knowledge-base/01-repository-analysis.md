# 01 — تحليل المستودع الشامل

## معلومات عامة

- **الاسم**: Grocery System (نظام إدارة بقالة)
- **النوع**: Monorepo (pnpm workspaces)
- **النوع التطبيقي**: PWA عربي (RTL) — multi-worker
- **اللغة الأساسية**: TypeScript (strict)
- **Repo**: https://github.com/moain2026/mohanad-web-app
- **Default Branch**: `genspark_ai_developer`

## بنية المجلدات الفعلية

```
/home/user/webapp/                            (root)
├── apps/
│   ├── api/                                  NestJS 10 backend
│   │   ├── src/
│   │   │   ├── app.module.ts                 ← يسجل: Health, Auth, Users, Roles, Permissions, Customers, Notifications
│   │   │   ├── main.ts
│   │   │   ├── common/
│   │   │   │   ├── filters/all-exceptions.filter.ts
│   │   │   │   ├── interceptors/response-format.interceptor.ts
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── idempotency.middleware.ts        ✅ active
│   │   │   │   │   └── request-id.middleware.ts
│   │   │   │   └── pipes/zod-validation.pipe.ts
│   │   │   ├── config/                        Env validation (Zod)
│   │   │   └── modules/
│   │   │       ├── auth/                      ✅ login/refresh/logout/me/change-password + JWT + lockout
│   │   │       ├── customers/                 ✅ Phase 3 backend (controller + service + tx + module)
│   │   │       ├── health/                    ✅ /health
│   │   │       ├── notifications/             ✅ Phase 3 backend
│   │   │       ├── permissions/               ✅ Phase 2
│   │   │       ├── prisma/                    PrismaService wrapper
│   │   │       ├── roles/                     ✅ Phase 2
│   │   │       └── users/                     ✅ Phase 2
│   │   └── package.json                       Nest 10 + Prisma 5 + JWT + Passport + Zod
│   └── web/                                   React 18 + Vite + Ionic 8 + Tailwind PWA
│       ├── public/fonts/                      IBM Plex Sans Arabic (woff2 self-hosted)
│       ├── public/icons/                      PWA icons
│       ├── src/
│       │   ├── App.tsx
│       │   ├── routes.tsx                     ⚠️ يفتقد: customers/*, suppliers/*, purchases/*, notifications
│       │   ├── components/
│       │   │   ├── ui/                        13 components (Button, Modal, BottomSheet, ResponsiveDialog…)
│       │   │   ├── layout/                    AppShell, Sidebar, BottomNav, MobileTopBar, PageHeader
│       │   │   ├── dashboard/                 StatCard, Sparkline, QuickActionCard
│       │   │   ├── permissions/               PermissionGate, PermissionsEditor
│       │   │   └── ProtectedRoute.tsx
│       │   ├── design/                        tokens.ts, fonts.css
│       │   ├── features/admin/                admin features
│       │   ├── hooks/                         useResponsive, useLockoutCountdown
│       │   ├── i18n/ar.ts                     Arabic strings
│       │   ├── lib/                           http.ts, api.ts, queryClient.ts, cn.ts, HttpBridge.tsx
│       │   ├── pages/
│       │   │   ├── LoginPage.tsx              ✅
│       │   │   ├── DashboardPage.tsx          ✅
│       │   │   ├── AccountPage.tsx            ✅
│       │   │   ├── NotFoundPage.tsx           ✅
│       │   │   └── admin/
│       │   │       ├── UsersListPage.tsx      ✅
│       │   │       ├── UserDetailPage.tsx     ✅
│       │   │       ├── RolesListPage.tsx      ✅
│       │   │       └── RoleFormPage.tsx       ✅
│       │   ├── stores/authStore.ts            Zustand
│       │   ├── styles/                        globals.css
│       │   └── test/setup.ts                  Vitest
│       └── package.json                       React 18 + Ionic 8 + RR v5 + TanStack Query + RHF + Framer
├── packages/
│   └── shared/
│       └── src/
│           ├── constants/                     permissions.ts (181), roles.ts, enums.ts
│           ├── schemas/                       auth.ts, common.ts, customers.ts, notifications.ts, roles.ts, users.ts
│           ├── types/                         index.ts
│           └── utils/                         index.ts
├── prisma/
│   ├── schema.prisma                          14 models (Foundation 8 + Auth 2 + Customer 3 + Notification 1)
│   ├── seed.ts                                idempotent owner + 6 roles + 181 permissions + 9 settings
│   ├── seed-test-users.ts
│   └── migrations/
│       ├── 20260428011941_init_phase2_auth/
│       ├── 20260430021035_p3_customers_notifications/
│       └── migration_lock.toml                postgresql
├── docs/
│   ├── 00-project-overview.md ... 13-pre-foundation-checklist.md
│   ├── 12-agent-memory.md                     ⭐ القرارات المُقفلة
│   ├── recovery-report.md                     تاريخ المراجعات
│   ├── legacy/                                schema-archive
│   ├── phase2/                                curl + screenshots + lighthouse + manual-tests
│   └── phase3/                                ⚠️ مفقود — سننشئه
├── scripts/lighthouse.mjs
├── biome.json
├── tsconfig.base.json
├── pnpm-workspace.yaml
├── package.json                               root scripts
├── DEVELOPMENT.md
├── README.md
└── .nvmrc                                     20
```

## Tech Stack المؤكد (من package.json + lock files)

### Frontend (apps/web)
- React 18.3.1 + TypeScript 5.5
- Vite 5.4 + vite-plugin-pwa 0.20
- Ionic React 8.4 + Ionic Router 8.4 (locks RR v5.3.4)
- Tailwind CSS 3.4 + tailwindcss-rtl
- Zustand 5.0 (auth/UI state)
- TanStack Query 5.59 (server state)
- Axios 1.7
- React Hook Form 7.53 + @hookform/resolvers
- Zod 3.23.8 (pinned via overrides)
- Framer Motion 11
- Lucide React 0.460
- @formkit/auto-animate 0.8
- dayjs 1.11

### Backend (apps/api)
- NestJS 10.4
- Prisma 5.22 (@prisma/client)
- @nestjs/jwt 11 + @nestjs/passport 11 + passport-jwt 4
- @nestjs/swagger 7 + @scalar/nestjs-api-reference (Scalar UI at /api/v1/docs)
- @nestjs/throttler 6 (rate limiting)
- nestjs-pino 4 (logger)
- bcrypt 6 (rounds=12)
- helmet 8
- cookie-parser 1.4
- Zod 3.23.8

### Tests
- Vitest 2.0 (web + shared)
- Jest 29 + ts-jest (api)
- @testing-library/react 16 + jest-dom 6
- jsdom 25

### Tooling
- Biome 1.9.4 (lint + format, replaces ESLint + Prettier)
- Husky 9 + lint-staged 15
- pnpm 9.15.9 (workspaces, no Turborepo)
- TypeScript 5.5
- tsx 4.19 (seed runner)
- Prisma 5.22 (migrate dev/format/validate)

## Git Status
- Current branch: `genspark_ai_developer`
- Up to date with origin
- Untracked: `package-lock.json` (rogue — يجب إزالته أو تجاهله؛ المشروع يستخدم pnpm-lock.yaml)
- Last commit: `3f5eb1c Merge pull request #5 from moain2026/genspark_recovery`

## Last 10 Commits
```
3f5eb1c Merge pull request #5 from moain2026/genspark_recovery
75af4e9 Merge pull request #4 from moain2026/genspark_ai_developer
85f4ba1 Merge pull request #3 from moain2026/genspark_recovery
485420f feat(p3-2,p3-3,p3-4,p3-5): customers + transactions + notifications backend
e2f0bd0 feat(p3-1): customers + transactions + reminders + notifications schema
d193947 Merge pull request #2 from moain2026/genspark_recovery
c5cfaa9 feat(p2-7): tests + docs + coverage + lighthouse + screenshots
df4a1d2 feat(p2-6): admin UI — users, roles, permissions editor, account
3a710fa feat(p2-5): auth frontend core + idempotency middleware
5fd3a45 feat(p2-4): RBAC backend (users + roles + permissions CRUD)
```

## Phases Status (مُحدَّث)

| المرحلة | الوصف | الحالة الفعلية |
|---------|-------|----------------|
| 0 | Documentation | ✅ done (docs/00..13 + 12-agent-memory.md) |
| 1 | Foundation | ✅ done (Recovery completed) |
| 2 | Auth + RBAC | ✅ done (P2-1 → P2-7, 208 tests) |
| **3 Backend** | Customers + Notifications API | ✅ done (P3-1 schema + P3-2..5 services) |
| **3 Frontend** | Customers UI + Notifications UI + WhatsApp | ❌ **NOT STARTED** ← Part B |
| **4** | Suppliers + Purchases | ❌ **NOT STARTED** ← Part C |
| 5 | Expenses + Daily Income | ⏳ pending (مؤجل لبرومبت لاحق) |
| 6 | Sales Modes | ⏳ pending |
| 7 | Reports | ⏳ pending |
| 8 | Notifications + WhatsApp polish | ⏳ pending |
| 9 | Inventory (optional) | ⏳ pending |
| 10 | Polish + PWA + Deployment | ⏳ pending |
