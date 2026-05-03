# 08 — خطة التنفيذ التفصيلية

## ترتيب التنفيذ (Sequential)

### Stage 0: Setup (الآن)
1. ✅ قراءة كل docs المعتمدة
2. ✅ بناء مجلد `knowledge-base/`
3. ⏳ إنشاء branch `phase34_completion` من `genspark_ai_developer`
4. ⏳ تشغيل `pnpm install` + `pnpm db:generate`
5. ⏳ تشغيل DoD حالي: `pnpm lint && pnpm typecheck && pnpm test`
6. ⏳ كتابة `knowledge-base/10-audit-report.md`
7. ⏳ Commit الـ knowledge-base + push

### Stage 1: Part B — Phase 3 Frontend
خطة تدريجية مع commit بعد كل subphase:

#### B-Setup
- إضافة `lib/api/customers.ts` و `lib/api/customerTransactions.ts`
- إضافة `lib/api/notifications.ts`
- إضافة TanStack Query hooks في `features/customers/queries.ts`

#### B-Components (UI primitives لـ customers)
- `BalanceDisplay.tsx`، `StatusBadge.tsx`، `CustomerCard.tsx`، `CustomerInfoCard.tsx`
- `WhatsAppButton.tsx` + utility `lib/whatsapp.ts`
- `TransactionsTimeline.tsx`
- Tests: BalanceDisplay coloring, generateWhatsAppLink

#### B-Modals
- `AddDebtModal.tsx`، `RecordPaymentModal.tsx`
- `CreditLimitEditor.tsx`، `FreezeCustomerDialog.tsx`، `GrantGraceDialog.tsx`
- Tests: balance preview, credit limit warning

#### B-Pages
- `CustomersListPage.tsx`
- `CustomerDetailPage.tsx`
- `NewCustomerPage.tsx`، `EditCustomerPage.tsx`
- `CustomerStatementPage.tsx`
- Tests: list search/filter/pagination

#### B-Notifications UI
- `components/notifications/NotificationBell.tsx`
- `pages/NotificationsPage.tsx`
- إدراج NotificationBell في `MobileTopBar` و `Sidebar`/AppShell
- Tests: unread count, dropdown

#### B-Routes & Nav
- تحديث `routes.tsx` بالمسارات الجديدة
- التحقق من Sidebar/BottomNav (لا يحتاج تغيير)

#### B-Bonuses (subtle)
- count-up animation في BalanceDisplay
- Confetti مرة واحدة عند تصفير عميل
- Recent customers widget في Dashboard
- Quick keyboard shortcuts (D/P/W) في CustomerDetailPage

#### B-Docs & Verify
- `docs/phase3/manual-tests.md`
- `docs/phase3/curl/*.txt`
- 8 screenshots
- DoD: lint + typecheck + test + build

**commit**: `feat(p3-frontend): customers ui + notifications ui + whatsapp deep links`

### Stage 2: Part C — Phase 4 (Suppliers + Purchases)

#### C1-Schema
- إضافة 4 models + 3 enums في `prisma/schema.prisma`
- إضافة relations في Store + User
- `pnpm db:generate` (بدون migrate run — لا DB متاحة في sandbox)
- create migration file يدوياً تحت `prisma/migrations/<ts>_p4_suppliers_purchases/migration.sql` (أو نستخدم `prisma migrate dev --create-only`)

#### C2-Shared Schemas
- `packages/shared/src/schemas/suppliers.ts`
- `packages/shared/src/schemas/purchases.ts`
- export من `schemas/index.ts`

#### C3-Backend Suppliers
- `apps/api/src/modules/suppliers/suppliers.service.ts` + controller
- `apps/api/src/modules/suppliers/supplier-transactions.service.ts` + controller
- `suppliers.module.ts`
- التسجيل في `app.module.ts`
- specs: `suppliers.service.spec.ts`, `supplier-transactions.service.spec.ts`

#### C4-Backend Purchases
- `apps/api/src/modules/purchases/purchases.service.ts` (cash + credit + cancel + list)
- `purchases.controller.ts`
- `purchases.module.ts` + التسجيل
- specs: `purchases.service.spec.ts` ⭐ critical (cash NO balance change + credit increases)

#### C5-Seed Update
- إضافة توزيع الـ permissions للأدوار الجديدة

#### C6-Frontend Suppliers
- `lib/api/suppliers.ts` + `supplierTransactions.ts`
- pages + components (mirror customers)
- Tests

#### C7-Frontend Purchases
- `lib/api/purchases.ts`
- `pages/purchases/PurchasesListPage.tsx`
- `pages/purchases/NewPurchasePage.tsx` (3-step wizard)
- `pages/purchases/PurchaseDetailPage.tsx`
- `components/purchases/PaymentTypeRadio.tsx` (visual cards)
- `components/purchases/SupplierPickerInline.tsx`
- `components/purchases/PurchaseReceiptConfirmation.tsx`
- Tests

#### C8-Routes Update
- `/suppliers`, `/suppliers/new`, `/suppliers/:id`, `/suppliers/:id/edit`, `/suppliers/:id/statement`
- `/purchases`, `/purchases/new`, `/purchases/:id`

#### C9-Docs & Verify
- `docs/phase4/manual-tests.md`
- `docs/phase4/curl/*.txt`
- 7+ screenshots
- DoD: كل الفحوصات خضراء

**commit**: `feat(p4): suppliers + supplier-transactions + purchases (cash + credit)`

### Stage 3: Final
- تحديث `knowledge-base/10-audit-report.md` بالنتائج النهائية
- تحديث `docs/12-agent-memory.md` (Phase 3 + Phase 4 log) — مع تنبيه أن §16 يحتاج موافقة
- تحديث `docs/recovery-report.md` — إضافة قسم Phase 3 + Phase 4
- تحديث `README.md` بالحالة الجديدة
- Push branch
- Open PR من `phase34_completion` → `genspark_ai_developer`

## ملاحظات مهمة على البيئة

### قيود السandbox
- ⚠️ لا يوجد PostgreSQL متاح في sandbox، لذا:
  - لن نستطيع تشغيل `prisma migrate dev` فعلياً مع DB live
  - سننشئ migration file يدوياً (SQL) أو نستخدم `prisma migrate diff` للتوليد
  - لن نستطيع تشغيل live curl ضد الـ API (no DB → Auth/Customer endpoints يفشلون)
  - الـ DB-dependent tests نعتمد على mocks (وهذا ما تفعله الـ Jest specs الحالية أصلاً)

### الـ PrismaService في الاختبارات
- موجود pattern في `auth.service.spec.ts` و `users.service.spec.ts` و `roles.service.spec.ts`
- نستخدم `jest.fn()` mocks للـ Prisma client
- نتبع نفس النمط للـ suppliers/purchases specs

### Frontend Tests
- Vitest + jsdom + React Testing Library
- نستخدم `MemoryRouter` بدلاً من `BrowserRouter` (RR v5)
- نستخدم `QueryClientProvider` mock للـ TanStack Query

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| DB غير متاحة → migration لن تُطبَّق | نُنتج SQL migration file فقط — التطبيق على Railway سيتم لاحقاً |
| Live e2e curl غير ممكن | نقدم curl examples + transcript محاكي + jest specs مع coverage |
| Vitest قد يفشل بسبب IBM Plex fonts loading | نتأكد من setup.ts لا يستدعي fonts feature في الاختبارات |
| الوقت الطويل للتنفيذ | نقسم على commits صغيرة + push بعد كل stage |
