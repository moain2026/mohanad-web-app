# 07 — تحليل الفجوات (Gap Analysis) — ⭐ ما المتبقي

> هذا الملف يحدد بدقة ما المتبقي لإكمال البرومبت. مرتب حسب الأولوية.

## ✅ ما تم إنجازه (لا تكرّره)

### Phase 1 — Foundation (مكتملة)
- ✅ Monorepo + Design System + 8 Prisma models أصلية
- ✅ Biome + Husky + lint-staged
- ✅ Self-hosted fonts (IBM Plex Sans Arabic + JetBrains Mono)
- ✅ PWA setup (vite-plugin-pwa)
- ✅ 13 UI components + 5 layout + 3 dashboard
- ✅ React Router v5 (locked by Ionic 8)
- ✅ TanStack Query + Zustand + Axios

### Phase 2 — Auth + RBAC (مكتملة)
- ✅ JWT (15min access + 7d/30d refresh httpOnly cookie)
- ✅ bcrypt rounds=12
- ✅ Lockout (5 attempts / 15min)
- ✅ Refresh token rotation + replay detection
- ✅ Idempotency middleware (24h TTL)
- ✅ 19 modules / 181 permissions في seed
- ✅ 6 system roles (Owner, Manager, SalesWorker, Accountant, PurchasingOfficer, InventoryOfficer)
- ✅ Admin UI (Users, Roles, Permissions Editor, Account)
- ✅ 208 tests (shared 69 + api 70 + web 69)

### Phase 3 — Customers Backend (مكتملة)
- ✅ Schema: Customer + CustomerTransaction + CustomerReminderSettings + Notification (+ enums)
- ✅ Migration: `20260430021035_p3_customers_notifications`
- ✅ `CustomersService` + `CustomersController` (list/detail/balance/statement/CRUD/freeze/unfreeze/grant-grace/credit-limit)
- ✅ `CustomerTransactionsService` + `CustomerTransactionsController` (list/debt/payment/adjustment/cancel)
- ✅ `NotificationsService` + `NotificationsController` (list/unread-count/mark-read/mark-all)
- ✅ Atomic transactions + balance snapshots + audit logs
- ✅ Frozen check + credit limit check + approve_over_limit gate
- ✅ Shared schemas في `packages/shared/src/schemas/customers.ts` و `notifications.ts`

---

## ❌ ما المتبقي (Part B + Part C)

### 🔵 Part B — Phase 3 Frontend (Customers UI + Notifications + WhatsApp)

#### B1: Customers Pages (5 صفحات)
| الملف | المسار | Permission |
|-------|-------|-----------|
| `pages/customers/CustomersListPage.tsx` | `/customers` | `customers.view` |
| `pages/customers/CustomerDetailPage.tsx` | `/customers/:id` | `customers.view` |
| `pages/customers/NewCustomerPage.tsx` | `/customers/new` | `customers.create` |
| `pages/customers/EditCustomerPage.tsx` | `/customers/:id/edit` | `customers.update` |
| `pages/customers/CustomerStatementPage.tsx` | `/customers/:id/statement` | `customers.print_statement` |

#### B2: Customer Components (11 components)
- `CustomerCard.tsx` (list item mobile)
- `CustomerInfoCard.tsx` (top card في detail)
- `BalanceDisplay.tsx` (color coding: سالب=أزرق، موجب=أحمر، صفر=أخضر)
- `StatusBadge.tsx` (active/frozen/grace)
- `AddDebtModal.tsx` (balance preview + credit limit warning)
- `RecordPaymentModal.tsx` (warning إن دفع زيادة)
- `WhatsAppButton.tsx` (deep link generator)
- `TransactionsTimeline.tsx` (recent transactions)
- `CreditLimitEditor.tsx`
- `FreezeCustomerDialog.tsx`
- `GrantGraceDialog.tsx`

#### B3: API Client (`apps/web/src/lib/api/customers.ts`)
```typescript
customersApi.{ list, get, create, update, delete, freeze, unfreeze, grantGrace, setCreditLimit, getBalance, getStatement }
customerTransactionsApi.{ list, createDebt, createPayment, cancel, createAdjustment }
```

#### B4: Notifications UI
- `components/notifications/NotificationBell.tsx` (badge + dropdown في TopBar)
- `pages/NotificationsPage.tsx` (full list with groups: Today/Yesterday/Week/Older)
- `lib/api/notifications.ts`
- TanStack Query: staleTime 30s + refetchInterval 60s للـ unread count

#### B5: WhatsApp Deep Link
```typescript
function generateWhatsAppLink(customer, template, vars) {
  const message = template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`);
  const phone = (customer.whatsappPhone || customer.phone || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
```

#### B6: Routes Update (`apps/web/src/routes.tsx`)
أضف:
- `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/customers/:id/statement`
- `/notifications`

#### B7: Bottom Nav
✅ "العملاء" tab موجود بالفعل مع `anyOf: ['customers.view', 'customer_transactions.view']`

#### B8: Tests (≥ متوسط 5 لكل feature)
- CustomersListPage: search, filter, pagination
- AddDebtModal: balance preview, credit limit warning
- WhatsApp link generation
- NotificationBell: unread count, dropdown
- BalanceDisplay color coding
- generateWhatsAppLink utility

#### B9: Screenshots + Docs
- 8 screenshots (customers list, detail, add debt, payment, statement, notifications, whatsapp click)
- `docs/phase3/manual-tests.md`
- `docs/phase3/curl/` outputs

#### B10: Bonuses (subtle)
- ✅ Customer balance change animation (count-up via framer-motion)
- ✅ Confetti عند تصفير حساب عميل (مرة واحدة)
- ✅ Voice-friendly inputs على mobile (`inputmode="decimal"` + `autocomplete`)
- ✅ Quick keyboard shortcuts (D=debt, P=payment, W=whatsapp)
- ✅ Recent customers في الـ home page (Dashboard widget)

---

### 🟠 Part C — Phase 4 (Suppliers + Purchases)

#### C1: Schema Changes (`prisma/schema.prisma`)
أضف 4 models جديدة:
- `Supplier` (مع opening/currentBalance + soft delete)
- `SupplierTransaction` (CREDIT_PURCHASE | PAYMENT | ADJUSTMENT | OPENING)
- `Purchase` (purchaseMode + paymentType + totalAmount)
- `PurchaseItem` (productId nullable + name + quantity + unitPrice)

أضف 3 enums:
- `SupplierTransactionType`
- `PurchaseMode` (TOTAL_ONLY | DETAILED)
- `PurchasePaymentType` (CASH | CREDIT)

أضف relations في `Store` و `User`.

أنشئ migration: `p4_suppliers_purchases`

#### C2: Permissions
✅ موجودة بالفعل في `permissions.ts` و الـ seed (suppliers, supplier_transactions, purchases)
- نتأكد من توزيعها على الأدوار في `seed.ts`

#### C3: Backend Modules
```
apps/api/src/modules/
├── suppliers/                          ❌
│   ├── suppliers.controller.ts
│   ├── suppliers.service.ts
│   ├── supplier-transactions.controller.ts
│   ├── supplier-transactions.service.ts
│   └── suppliers.module.ts
└── purchases/                          ❌
    ├── purchases.controller.ts
    ├── purchases.service.ts
    └── purchases.module.ts
```

تسجيلها في `app.module.ts`.

#### C4: Critical Logic

**Cash Purchase:**
```typescript
async createCashPurchase(dto, userId) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({...dto, paymentType: 'CASH'});
    // ⚠️ NO expense, NO supplier balance change
    await tx.auditLog.create({...});
    return purchase;
  });
}
```

**Credit Purchase:**
```typescript
async createCreditPurchase(dto, userId) {
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE on supplier
    const [supplier] = await tx.$queryRaw`
      SELECT * FROM suppliers WHERE id = ${dto.supplierId} FOR UPDATE
    `;
    const purchase = await tx.purchase.create({...dto, paymentType: 'CREDIT'});
    await tx.supplierTransaction.create({
      type: 'CREDIT_PURCHASE',
      balanceBefore: supplier.currentBalance,
      balanceAfter: supplier.currentBalance + dto.totalAmount,
      referenceType: 'Purchase', referenceId: purchase.id,
    });
    await tx.supplier.update({
      where: { id: dto.supplierId },
      data: { currentBalance: { increment: dto.totalAmount } },
    });
    await tx.auditLog.create({...});
    return purchase;
  });
}
```

#### C5: Shared Schemas (`packages/shared/src/schemas/`)
- `suppliers.ts` (createSupplierSchema, updateSupplierSchema, listQuery, supplierTransactions)
- `purchases.ts` (createCashPurchaseSchema, createCreditPurchaseSchema, listQuery)

#### C6: Frontend Pages
```
pages/suppliers/
├── SuppliersListPage.tsx
├── SupplierDetailPage.tsx
├── NewSupplierPage.tsx
├── EditSupplierPage.tsx
└── SupplierStatementPage.tsx

pages/purchases/
├── PurchasesListPage.tsx
├── NewPurchasePage.tsx          ← الأهم (3 steps wizard)
└── PurchaseDetailPage.tsx
```

#### C7: Purchase Form (الأهم)
- Step 1: Supplier selector (search + create-on-fly)
- Step 2: Payment type (CASH | CREDIT) — visual radio cards
- Step 3: Amount + notes + receipt number
- Live preview: "هذا سيزيد دين المورد بـ X" (إن credit)
- Submit + receipt confirmation page

#### C8: Tests
- Cash purchase: NO supplier balance change (CRITICAL test)
- Credit purchase: balance increases atomically (with parallel call test)
- Cancel purchase reverses balance
- Supplier statement accurate
- Frontend: PurchaseForm validation, payment type switch behavior

#### C9: Routes Update + Sidebar
أضف routes و عناصر sidebar (موجودة بالفعل عناصر `suppliers` و `purchases`).

#### C10: Coverage Target
- ≥85% on `purchases.service`
- ≥85% on `suppliers.service`
- ≥85% on `supplier-transactions.service`
- ≥320 tests total (208 موجود + 112+ جديد)

---

## Test Counts Target

| Phase | Current | Target |
|-------|---------|--------|
| Total | 208 | ≥320 |
| Part B (Phase 3 FE) increment | — | +50 |
| Part C (Phase 4 BE+FE) increment | — | +60 |

## Final Deliverables Checklist

- [ ] Audit report (Part A)
- [ ] All commits hashes (Part B + Part C)
- [ ] PR link (`phase34_completion` → `genspark_ai_developer`)
- [ ] DoD checklist (15+ بند)
- [ ] Test counts breakdown
- [ ] Coverage report
- [ ] Screenshots ≥15 (Customers + Suppliers + Purchases)
- [ ] Curl evidence (atomic tx, cash vs credit, audit logs)
- [ ] Creative decisions documented
- [ ] Known limitations documented

## ممنوعات صارمة (لا تكسرها)

❌ لا Sales / Expenses / DailyIncome / Reports
❌ لا Inventory / Products
❌ لا نشر على Railway
❌ لا تخالف docs/12-agent-memory.md
❌ لا تتخطى Audit في Part A
❌ لا تتخطى أي DoD checkpoint
❌ لا Tajawal — IBM Plex Sans Arabic فقط
❌ لا تخلط expense و purchase في cash flow
