# 06 — كتالوج الصلاحيات (181 permission / 19 module)

> المصدر: `packages/shared/src/constants/permissions.ts`
> Single Source of Truth — يُستخدم في الـ seed (Prisma) و الـ Permissions Editor (UI)

## الـ 19 Module

| # | Module | Group AR | الحالة |
|---|--------|----------|--------|
| 1 | system | النظام والإعدادات | ✅ Phase 2 |
| 2 | users | المستخدمون | ✅ Phase 2 |
| 3 | roles | الأدوار والصلاحيات | ✅ Phase 2 |
| 4 | permissions | الأدوار والصلاحيات | ✅ Phase 2 |
| 5 | customers | العملاء | ✅ Backend done, ❌ Frontend |
| 6 | customer_transactions | حركات ديون العملاء | ✅ Backend done, ❌ Frontend |
| 7 | sales | البيع | ⏳ مؤجل |
| 8 | daily_income | الدخل اليومي | ⏳ مؤجل |
| 9 | expenses | المصاريف | ⏳ مؤجل |
| 10 | expense_categories | المصاريف | ⏳ مؤجل |
| 11 | suppliers | التجار (الموردون) | ❌ **Phase 4** |
| 12 | supplier_transactions | حركات التجار | ❌ **Phase 4** |
| 13 | purchases | المشتريات | ❌ **Phase 4** |
| 14 | products | المنتجات | ⏳ مؤجل |
| 15 | inventory | المخزون | ⏳ مؤجل |
| 16 | stock_movements | حركات المخزون | ⏳ مؤجل |
| 17 | reports | التقارير | ⏳ مؤجل |
| 18 | notifications | الإشعارات | ✅ Backend done, ❌ Frontend |
| 19 | audit_logs | سجل الحركات | ⏳ مؤجل |

## Permissions ذات الصلة بـ Part B (Phase 3 Frontend)

### customers
- `customers.view`, `customers.create`, `customers.update`, `customers.delete`, `customers.restore`
- `customers.view_balance`, `customers.view_transactions`
- `customers.set_credit_limit`, `customers.freeze`, `customers.unfreeze`, `customers.grant_grace`
- `customers.clear_account`, `customers.export`, `customers.print_statement`

### customer_transactions
- `customer_transactions.view`, `customer_transactions.create_debt`, `customer_transactions.create_payment`
- `customer_transactions.create_adjustment`, `customer_transactions.update`
- `customer_transactions.cancel`, `customer_transactions.delete`
- `customer_transactions.approve_over_limit`, `customer_transactions.approve_large_amount`
- `customer_transactions.print_receipt`

### notifications
- `notifications.view_own`, `notifications.view_all`, `notifications.create`, `notifications.mark_read`
- `notifications.manage_settings`, `notifications.manage_templates`
- `notifications.send_internal`, `notifications.send_whatsapp`
- `notifications.schedule_customer_reminders`, `notifications.cancel_scheduled`

## Permissions ذات الصلة بـ Part C (Phase 4)

### suppliers (موجودة بالفعل في الـ catalog)
- `suppliers.view`, `suppliers.create`, `suppliers.update`, `suppliers.delete`, `suppliers.restore`
- `suppliers.view_balance`, `suppliers.view_transactions`
- `suppliers.set_opening_balance`, `suppliers.print_statement`

### supplier_transactions (موجودة بالفعل في الـ catalog)
- `supplier_transactions.view`, `supplier_transactions.create_credit_purchase`
- `supplier_transactions.create_payment`, `supplier_transactions.create_adjustment`
- `supplier_transactions.update`, `supplier_transactions.cancel`, `supplier_transactions.delete`
- `supplier_transactions.print_receipt`

### purchases (موجودة بالفعل في الـ catalog)
- `purchases.view`, `purchases.create`, `purchases.create_cash`, `purchases.create_credit`
- `purchases.create_with_items`, `purchases.create_total_only`
- `purchases.update`, `purchases.cancel`, `purchases.delete`, `purchases.print_invoice`, `purchases.approve`

> ✅ **ملاحظة مهمة**: كل الـ permissions للـ Phase 4 موجودة بالفعل في `permissions.ts` و الـ `seed.ts`. لا حاجة لإضافة جديدة.

## ملاحظة على الـ Seed

عند تشغيل `pnpm db:seed`، يتم إنشاء:
- 1 owner user (Owner@12345)
- 6 system roles: `Owner`, `Manager`, `SalesWorker`, `Accountant`, `PurchasingOfficer`, `InventoryOfficer`
- 181 permissions (catalog كامل)
- 9 settings (default sales mode, currency, large transaction threshold...)

## التوزيع الموصى به للأدوار (Phase 4)

| Role | Suppliers | Supplier Tx | Purchases |
|------|-----------|-------------|-----------|
| Owner | كل الصلاحيات | كل الصلاحيات | كل الصلاحيات |
| Manager | view, create, update, view_balance, view_transactions, print_statement | view, create_payment, create_adjustment, cancel, print_receipt | كل الصلاحيات عدا delete |
| Accountant | view, view_balance, view_transactions, print_statement | view, create_payment, create_adjustment, print_receipt | view, print_invoice |
| PurchasingOfficer | view, create, update, view_balance, view_transactions | view, create_credit_purchase, create_payment | كل الصلاحيات عدا delete + approve |
| InventoryOfficer | view | view | view, create_with_items, create_total_only |
| SalesWorker | (لا شيء) | (لا شيء) | (لا شيء) |
