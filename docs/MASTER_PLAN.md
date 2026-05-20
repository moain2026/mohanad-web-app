# MASTER_PLAN.md — تحليل المستودع + خطة الإنجاز

> **تاريخ الإعداد**: 2026-05-20
> **المُعِدّ**: AI Developer (genspark)
> **الفرع**: `genspark_ai_developer` (HEAD: `bb7c7d1`)
> **المرجعية**:
> - الكود الفعلي في `apps/`, `packages/`, `prisma/`
> - `docs/12-agent-memory.md` (القرارات المُقفلة — مرجع نهائي)
> - `knowledge-base/` (تحليل 2026-05-02)
> - `docs/PROJECT_STATUS.md` و `docs/AGENT_HANDOFF.md` (مُلحقَين بهذا الـ PR من فرع `docs/accurate-status-and-handoff` بعد تحديثهما)

---

## 1. الخلاصة التنفيذية (TL;DR)

نظام **إدارة بقالة** عربي (RTL) كامل، PWA، monorepo بـ pnpm workspaces. الـ Stack:
**NestJS 10 + Prisma 5 + Postgres** على الباكند، **React 18 + Vite 5 + Ionic 8 + Tailwind RTL** على الفرونت، **Biome** للـ lint/format، **Zod** للتحقق، **TanStack Query + Zustand** لإدارة الحالة.

| المؤشر                  | القيمة الحقيقية اليوم (مُتحقَّق منها بالكود) |
| ----------------------- | -------------------------------------------- |
| Prisma models           | **18** (Phases 1–4 مكتملة في الـ schema)     |
| Migrations              | 3 — `init_phase2_auth`, `p3_customers_notifications`, `p4_suppliers_purchases` |
| Permissions             | **181** code عبر **19** module               |
| Backend modules         | auth, users, roles, permissions, health, customers, notifications, suppliers, purchases |
| Frontend routes         | login, dashboard, account, admin/(users,roles), customers (5)، notifications، suppliers (5)، purchases (3) |
| Tests                   | **336 / 336 مرّت** — shared 97 · api 116 · web 123 |
| Lint                    | Biome — 0 errors · 1 تحذير (سكربت قديم)      |
| الفروع المُدمَجة         | `genspark_recovery` · `phase34_completion` · `phase4_suppliers_purchases` |
| الفروع غير المُدمَجة      | `docs/accurate-status-and-handoff` (وثائق فقط، متأخّرة عن main) |

**خلاصة**: المراحل 0 → 4 **مكتملة فعلياً** في الكود؛ المراحل 5 → 10 لم تبدأ. الوثائق في
الفرع `docs/accurate-status-and-handoff` متأخّرة (تقول "Phase 4 لم تبدأ" بينما تم دمجها).

---

## 2. هيكل المستودع — جرد سريع

```
mohanad-web-app/
├── apps/
│   ├── api/                        # NestJS — 9 modules
│   │   └── src/modules/
│   │       ├── auth, users, roles, permissions, health   ✅ Phase 1–2
│   │       ├── customers, notifications                  ✅ Phase 3
│   │       └── suppliers, purchases                      ✅ Phase 4
│   └── web/                        # React + Ionic + Vite
│       ├── src/components/{ui, layout, dashboard, permissions, customers, notifications, suppliers, purchases}
│       ├── src/pages/{LoginPage, DashboardPage, AccountPage, NotFoundPage, admin/, customers/, notifications/, suppliers/, purchases/}
│       └── src/{lib/, stores/, hooks/, i18n/, styles/}
├── packages/shared/                # Zod schemas + permissions catalog + utils
├── prisma/                         # 18 models + 3 migrations + seed
├── docs/                           # 13 design docs + recovery + (legacy/)
├── knowledge-base/                 # 11 ملف Audit (2026-05-02)
└── scripts/                        # Lighthouse + screenshots
```

---

## 3. تحليل الفروع

| الفرع                                    | الحالة     | المحتوى                                           |
| ---------------------------------------- | ---------- | ------------------------------------------------- |
| `genspark_ai_developer` (default)        | ✅ HEAD    | الفرع الرئيسي — كل المراحل المكتملة            |
| `genspark_recovery`                      | ⏬ مدمج    | Phase 1 + Phase 2 (PR #2, #3, #5)                |
| `phase34_completion`                     | ⏬ مدمج    | Phase 3 frontend + WhatsApp (PR #6)              |
| `phase4_suppliers_purchases`             | ⏬ مدمج    | Phase 4 backend + frontend + tests (PR #8)       |
| `docs/accurate-status-and-handoff`       | ⏳ مفتوح   | وثائق `PROJECT_STATUS.md` + `AGENT_HANDOFF.md` — **متأخّرة قبل دمج Phase 4** — نأخذ الملفّات ونحدّثها في هذا الـ PR بدلاً من دمج فرع قديم |

**القرار**: لن نقوم بدمج فرع `docs/accurate-status-and-handoff` كما هو لأنه يتعارض مع
حالة Phase 4 الحالية (يدّعي أنها لم تبدأ). بدلاً من ذلك نَنقل الملفّات الـ 2 الجديدة
ونعيد كتابتها لتعكس الواقع.

---

## 4. الفجوات المُحدَّدة (من Audit + Handoff + الكود)

1. **التنقّل** — `BottomNav` و `Sidebar` لا يحويان روابط `/notifications`، و `/suppliers` و `/purchases` لا يُختبَران، ولا يُعرَض المخزون/المبيعات (Phase 6/9) لتمييزها كقادمة. ✅ سنُصلحه.
2. **سجل التدقيق `AuditLog`** — الجدول موجود منذ Phase 1، ولكن **لا module يَكتب فيه** فعلياً. هذا تحذير صريح في `PROJECT_STATUS.md`. ✅ سنُغلق الفجوة بـ helper موحَّد ونوصِله بـ customers/suppliers/purchases.
3. **الجلسات النشطة (`RefreshToken`)** — الصفوف تُسجَّل في الـ DB ولكن لا UI تحت `/account` ولا API لاستعراضها/إبطالها. ✅ سنُضيفها (نقطة `/account` نفسها مُعدَّة لذلك).
4. **تنظيف `IdempotencyKey`** — تذكرة قديمة (TTL 24 ساعة، لا مُنظِّف). ✅ سنُضيف command + سكربت scheduler-ready (الـ cron الفعلي هو Phase 8 لكن الـ logic يَجب أن يكون جاهزاً).
5. **حالة الوثائق** — `README.md` يقول "Phase 1 مكتمل، 2–10 قيد الانتظار"؛ الحقيقة: 1–4 مكتملة. ✅ سنُصلحه.

> ما **لن نَلمسه** في هذا الـ PR (لإلتزام الـ Locked Decisions): النماذج الـ 18 القائمة،
> الـ 181 صلاحية، الـ 6 أدوار، تدفّق Auth، Ionic 8/RR v5، Biome.

---

## 5. الـ 5 مهام (Plan of Execution)

كل مهمة = commit (أو commits) منفصل، رسالة عرفية (`feat/`/`docs/`/`chore/`)، اختبارات
خضراء قبل المرور للتالية. كلها تَدخل في PR واحد على `genspark_ai_developer`.

> **حالة التنفيذ في هذا الـ PR**: المهام 1، 2، 3 ✅ مُنفَّذة بالكامل.
> المهمتان 4 و 5 ⏭️ مُؤجَّلتان إلى PRs مستقلة (موثَّقتان أدناه للالتقاط لاحقاً)
> لأن نطاق كل منهما يَستحق scope مُنفصل، ولأن المراجعة على PR أصغر أنظف.

### المهمة 1 — تحديث وثائق الحالة (Documentation Refresh) ✅
- نَستخرج `docs/PROJECT_STATUS.md` و `docs/AGENT_HANDOFF.md` من فرع
  `docs/accurate-status-and-handoff` ونُحدّثهما لتعكس:
  - 18 model (وليس 14)
  - 3 migrations
  - Phase 4 ✅ مكتملة (PR #8 merged)
  - 336 اختبار يَمر (لا 231)
  - الفرع التالي = Phase 5
- نُحدّث `README.md` ليطابق الحالة.
- نَضيف `MASTER_PLAN.md` (هذا الملف).
- **Commit**: `docs: refresh status + add MASTER_PLAN (phase 1–4 ✅, 336 tests, 18 models)`

### المهمة 2 — استكمال التنقّل (Navigation Wiring) ✅
- `BottomNav`: إضافة `/notifications` كجزء من قائمة "More" (لا تتجاوز 5 tabs).
- `Sidebar`: إضافة "الإشعارات" تحت قسم الحساب؛ التأكد من ظهور Suppliers/Purchases.
- ضبط حساب الـ active state لـ `/suppliers/:id` و `/purchases/:id` (يَستخدم `startsWith`
  بشكل صحيح؛ نُضيف اختبار).
- اختبارات: `BottomNav.test.tsx` + `Sidebar.test.tsx` للتأكد من ظهور كل عنصر حسب صلاحياته.
- **Commit**: `feat(nav): wire notifications + suppliers + purchases into bottom nav and sidebar`

### المهمة 3 — تشغيل سجل التدقيق (Audit-Log Emission) ✅
- `apps/api/src/common/audit/audit.helper.ts` — دالة `writeAuditLog(tx, opts)` تَستخدم
  نفس الـ Prisma transaction، تَكتب صفّاً مع `actorId`, `action`, `targetType`,
  `targetId`, `meta`.
- توصيل الـ helper في:
  - `customers.service.ts` — create/update/freeze/unfreeze/grantGrace/setCreditLimit/remove
  - `customer-transactions.service.ts` — createDebt/createPayment/createAdjustment/cancel
  - `suppliers.service.ts` — نفس النمط
  - `supplier-transactions.service.ts` — نفس النمط
  - `purchases.service.ts` — createCash/createCredit/cancel
- اختبارات: ≥ 6 spec جديدة تتحقّق أن كل عملية ماليّة تَكتب صفّاً واحداً في `AuditLog`.
- **Commit**: `feat(audit): emit AuditLog entries from customer/supplier/purchase services`

### المهمة 4 — إدارة الجلسات النشطة (Sessions UI) ⏭️ مُؤجَّلة
> مُؤجَّلة إلى PR مستقل (`maintenance/sessions-ui`) — تَستحق scope منفصل
> لأنها تَلمس `apps/api/src/modules/auth/` و `apps/web/src/pages/AccountPage.tsx`
> معاً. مُوثَّقة بكامل التصميم أعلاه ليلتقطها العميل التالي.
- **النطاق**: `GET /auth/sessions` + `POST /auth/sessions/:id/revoke` +
  `<SessionsList />` تحت `/account`.

### المهمة 5 — تنظيف Idempotency-Key (Maintenance Job Scaffold) ⏭️ مُؤجَّلة
> مُؤجَّلة إلى PR مستقل (`maintenance/idempotency-gc`) — التصميم الكامل أعلاه
> ليُنفَّذ مع cron الـ Phase 8 (يَستخدم نفس الـ `purgeExpired` service).
- **النطاق**: `IdempotencyCleanerService.purgeExpired(now)` + CLI hook.

### الإنهاء — التحقّق + الـ PR ✅
```bash
pnpm lint
pnpm typecheck
pnpm test
# الكل أخضر → push → فتح/تحديث PR على genspark_ai_developer (أو main حسب الـ workflow)
```

- Squash كل الـ commits إلى commit واحد شامل قبل الـ PR (حسب workflow الـ GenSpark).
- وصف الـ PR يَحوي:
  - ما الذي تَغيّر (5 مهام مَع روابط ملفّات).
  - عدد الاختبارات قبل/بعد.
  - الـ migration الـ status (لا migration جديد ← آمن للـ DB).
  - ما يبقى لـ Phase 5+ (`docs/PROJECT_STATUS.md §5` المُحدَّث).

---

## 6. ما لن نَفعله في هذا الـ PR (مَحدَّد بصراحة)

❌ Phase 5 (Expenses + Daily Income) — يَحتاج migration + module جديد بأكمله، يَستحق PR منفصل.
❌ Phase 6 (Sales) — نفس السبب.
❌ Phase 7 (Reports) — يَعتمد على 5 و 6.
❌ تعديل أي من الـ 18 model القائمة.
❌ تعديل الـ 181 صلاحية أو الـ 6 أدوار.
❌ تَرقية Ionic / React-Router / Biome.
❌ نشر إنتاج (Railway) — Phase 10.

---

## 7. الـ Risks المَعروفة + تخفيفها

| الخطر                                          | التخفيف                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| لا PostgreSQL في الـ sandbox → لا live DB tests | كل اختبارات الباكند تَستخدم Prisma mock — نفس النمط القائم        |
| `pnpm typecheck` recursive يَفشل من clean clone | نَبني `@grocery/shared` أولاً (موثَّق في `AGENT_HANDOFF.md §5`)      |
| لا headless browser → لا Playwright            | الاختبارات Vitest + RTL فقط لهذا الـ PR                            |
| نَكسر import موجود في customer/supplier        | كل تعديل يَتبع نمط الـ helper الإضافي (لا إعادة هيكلة)            |
| تَعارض في الـ rebase                            | الفرع الحالي محدَّث؛ نَعمل من HEAD مباشرة                          |

---

## 8. خاتمة

هذه الخطة موضوعة لتُغلق **الفجوات الباقية** من Phases 1–4 دون فتح أي مرحلة جديدة، مع
الالتزام الصارم بـ:
- 📌 القرارات المُقفلة في `docs/12-agent-memory.md`.
- 🧪 جميع الاختبارات خضراء قبل أي commit.
- 🧹 Biome lint + `tsc --noEmit` نظيفان.
- 🌐 جميع UI strings عربية، logs/comments إنجليزية.
- 💰 جميع العمليات الماليّة عبر `prisma.$transaction`.
- 🔒 `Idempotency-Key` على كل mutation.
- 🚫 لا حذف نهائي.

> هذا الملف هو "العقد" الذي سيُنفَّذ في الـ commits اللاحقة من هذا الـ PR.
