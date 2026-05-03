# 05 — حالة Frontend Pages & Components

## الصفحات الموجودة (✅)

| المسار | الملف | الـ Permission | الحالة |
|-------|------|---------------|--------|
| `/` | redirect → `/login` | — | ✅ |
| `/login` | `pages/LoginPage.tsx` | public | ✅ |
| `/dashboard` | `pages/DashboardPage.tsx` | auth | ✅ |
| `/admin/users` | `pages/admin/UsersListPage.tsx` | `users.view` | ✅ |
| `/admin/users/:id` | `pages/admin/UserDetailPage.tsx` | `users.view` | ✅ |
| `/admin/roles` | `pages/admin/RolesListPage.tsx` | `roles.view` | ✅ |
| `/admin/roles/new` | `pages/admin/RoleFormPage.tsx` | `roles.create` | ✅ |
| `/admin/roles/:id` | `pages/admin/RoleFormPage.tsx` | `roles.view` | ✅ |
| `/account` | `pages/AccountPage.tsx` | auth | ✅ |
| `*` | `pages/NotFoundPage.tsx` | — | ✅ |

## الصفحات المتبقية (❌) — Phase 3 Frontend (Part B)

### Customers Pages
- ❌ `pages/customers/CustomersListPage.tsx` — list + search + filter (status) + pagination
- ❌ `pages/customers/CustomerDetailPage.tsx` — info + actions + transactions timeline
- ❌ `pages/customers/NewCustomerPage.tsx` — create form
- ❌ `pages/customers/EditCustomerPage.tsx` — edit form
- ❌ `pages/customers/CustomerStatementPage.tsx` — printable statement

### Notifications Pages
- ❌ `pages/NotificationsPage.tsx` — full list (Today/Yesterday/Week/Older)

## الصفحات المتبقية (❌) — Phase 4 (Part C)

### Suppliers Pages
- ❌ `pages/suppliers/SuppliersListPage.tsx`
- ❌ `pages/suppliers/SupplierDetailPage.tsx`
- ❌ `pages/suppliers/NewSupplierPage.tsx`
- ❌ `pages/suppliers/EditSupplierPage.tsx`
- ❌ `pages/suppliers/SupplierStatementPage.tsx`

### Purchases Pages
- ❌ `pages/purchases/PurchasesListPage.tsx`
- ❌ `pages/purchases/NewPurchasePage.tsx`
- ❌ `pages/purchases/PurchaseDetailPage.tsx`

## Components الموجودة

### `components/ui/` (13 components)
- `Avatar.tsx`, `Badge.tsx`, `BottomSheet.tsx`, `Button.tsx`, `Card.tsx`
- `ConfirmDialog.tsx`, `DataTable.tsx`, `EmptyState.tsx`, `Input.tsx`, `Modal.tsx`
- `PageTransition.tsx`, `PasswordStrengthMeter.tsx`, `ResponsiveDialog.tsx`
- `Skeleton.tsx`, `Toast.tsx`

### `components/layout/`
- `AppShell.tsx`, `BottomNav.tsx`, `Breadcrumbs.tsx`, `MobileTopBar.tsx`, `PageHeader.tsx`, `Sidebar.tsx`

### `components/dashboard/`
- `QuickActionCard.tsx`, `Sparkline.tsx`, `StatCard.tsx`

### `components/permissions/`
- `PermissionGate.tsx`
- `PermissionsEditor.tsx`

### Other
- `components/ProtectedRoute.tsx`

## Components المتبقية (❌) — Part B

### `components/customers/`
- ❌ `CustomerCard.tsx` — list item (mobile)
- ❌ `CustomerInfoCard.tsx` — top card في detail
- ❌ `BalanceDisplay.tsx` — balance with color coding (سالب أزرق، موجب أحمر، صفر أخضر)
- ❌ `StatusBadge.tsx` — active/frozen/grace
- ❌ `AddDebtModal.tsx` — modal مع balance preview + credit limit warning
- ❌ `RecordPaymentModal.tsx` — modal مع warning إن دفع زيادة
- ❌ `WhatsAppButton.tsx` — deep link generator
- ❌ `TransactionsTimeline.tsx` — recent transactions
- ❌ `CreditLimitEditor.tsx`
- ❌ `FreezeCustomerDialog.tsx`
- ❌ `GrantGraceDialog.tsx`

### `components/notifications/`
- ❌ `NotificationBell.tsx` — badge + dropdown في TopBar

## Components المتبقية (❌) — Part C

### `components/suppliers/`
- ❌ `SupplierCard.tsx`, `SupplierInfoCard.tsx`, `SupplierBalanceDisplay.tsx`
- ❌ `RecordSupplierPaymentModal.tsx`, `SupplierTransactionsTimeline.tsx`
- ❌ `SupplierStatementPrintable.tsx`

### `components/purchases/`
- ❌ `PurchaseCard.tsx`
- ❌ `PaymentTypeRadio.tsx` — visual cards (CASH | CREDIT)
- ❌ `SupplierPickerInline.tsx` — search + create-on-fly
- ❌ `PurchaseReceiptConfirmation.tsx`

## API Clients الموجودة

- `lib/http.ts` — Axios instance + interceptors + auto-refresh
- `lib/api.ts` — wrappers (`apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete`, `extractApiError`)
- `lib/queryClient.ts` — TanStack Query client
- `lib/HttpBridge.tsx` — bridge بين Zustand + Axios للـ refresh
- `features/admin/...` — TanStack hooks للـ users/roles/permissions

## API Clients المتبقية (❌)

- ❌ `lib/api/customers.ts` — Part B
- ❌ `lib/api/customerTransactions.ts` — Part B
- ❌ `lib/api/notifications.ts` — Part B
- ❌ `lib/api/suppliers.ts` — Part C
- ❌ `lib/api/supplierTransactions.ts` — Part C
- ❌ `lib/api/purchases.ts` — Part C

## Routes Status

`apps/web/src/routes.tsx` يدعم حالياً:
- `/`, `/login`, `/dashboard`, `/admin/users`, `/admin/users/:id`, `/admin/roles`, `/admin/roles/new`, `/admin/roles/:id`, `/account`

❌ ينقصه: `/customers/*`, `/suppliers/*`, `/purchases/*`, `/notifications`

## Sidebar/BottomNav Status

✅ `Sidebar.tsx` يحتوي عناصر `customers`, `sales`, `suppliers`, `purchases`, `expenses`, `reports`, `settings` — كلها links جاهزة لكنها تشير لمسارات لا تزال 404.

✅ `BottomNav.tsx` يحتوي catalogue ديناميكي per-permission.

⚠️ نحتاج التأكد من أن "العملاء" يظهر في bottom nav للـ sales_worker — مفعّل بالفعل عبر `anyOf: ['customers.view', 'customer_transactions.view']`.

## i18n

- `i18n/ar.ts` — central Arabic strings dictionary
- ⚠️ نحتاج إضافة سلاسل لـ Customers/Suppliers/Purchases/Notifications

## Tests الموجودة (Frontend)

```
components/layout/__tests__/BottomNav.test.tsx
components/layout/__tests__/Breadcrumbs.test.tsx
components/permissions/__tests__/PermissionGate.test.tsx
components/permissions/__tests__/PermissionsEditor.test.tsx
components/ui/__tests__/PasswordStrengthMeter.test.tsx
hooks/__tests__/useLockoutCountdown.test.ts
hooks/__tests__/useResponsive.test.ts
lib/__tests__/api.test.ts
stores/__tests__/authStore.test.ts
```
9 ملفات (≈ 69 tests حسب recovery-report).
