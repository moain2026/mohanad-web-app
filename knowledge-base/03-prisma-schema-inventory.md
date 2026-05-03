# 03 — جرد Prisma Schema الكامل

> المصدر: `prisma/schema.prisma` (آخر تحديث: P3-1 — `e2f0bd0`)
> **عدد الـ models الفعلي: 14** (وليس 8 كما يذكر README القديم)

## الـ Models الموجودة

### Core (Foundation, P1)
1. **`Store`** — متجر واحد (multi-tenant ready عبر storeId)
2. **`Setting`** — key-value JSON settings per store (`@@unique([storeId, key])`)

### Identity & RBAC (P1 + P2)
3. **`User`** — username + password_hash + lockout fields + soft delete
4. **`Role`** — system roles + custom + isSystem flag
5. **`Permission`** — catalog (181 permissions, key unique)
6. **`RolePermission`** — junction (مع `constraints_json` reserved)
7. **`UserRole`** — junction

### Auth (P2)
8. **`RefreshToken`** — hashed (SHA-256) + rotation + replay detection
9. **`IdempotencyKey`** — TTL 24h + only 2xx cached

### Audit (P1)
10. **`AuditLog`** — append-only + old/new values + metadata + IP/UA

### Customers (P3-1)
11. **`Customer`** — name + phone + whatsappPhone + balance fields + status + creditLimit
12. **`CustomerTransaction`** — append-only ledger مع snapshots (DEBT/PAYMENT/ADJUSTMENT/OPENING)
13. **`CustomerReminderSettings`** — WhatsApp reminder config (1:1 مع Customer)

### Notifications (P3-1)
14. **`Notification`** — in-app + broadcast (userId nullable) + readAt

## الـ Enums

| Enum | القيم |
|------|------|
| `CustomerStatus` | ACTIVE, FROZEN, GRACE_PERIOD |
| `CustomerTransactionType` | DEBT, PAYMENT, ADJUSTMENT, OPENING |
| `NotificationType` | CREDIT_LIMIT_EXCEEDED, GRACE_PERIOD_ENDING, CUSTOMER_INACTIVE, CUSTOMER_DEBT_HIGH |
| `AuditAction` | create, update, cancel, delete, restore, login, login_failed, logout, permission_denied, role_change, permission_change, password_reset, user_deactivate, user_reactivate, settings_change, large_transaction, export, print |

## الـ Models المتبقية (Phase 4 سننشئها)

15. **`Supplier`** — name + phone + contactPerson + opening/currentBalance + isActive + soft delete
16. **`SupplierTransaction`** — CREDIT_PURCHASE | PAYMENT | ADJUSTMENT | OPENING + snapshots
17. **`Purchase`** — purchaseMode (TOTAL_ONLY | DETAILED) + paymentType (CASH | CREDIT) + totalAmount
18. **`PurchaseItem`** — purchaseId + productId nullable + name + quantity + price

## Relations المهمة

- `Store` 1—n: `User`, `Role`, `Setting`, `AuditLog`, `Customer`, `Notification`
- `User` ↔ `Role` via `UserRole`
- `Role` ↔ `Permission` via `RolePermission`
- `User` 1—n: `RefreshToken`, `Customer (createdBy)`, `CustomerTransaction (createdBy/cancelledBy)`, `Notification`
- `Customer` 1—n: `CustomerTransaction`; 1—1: `CustomerReminderSettings`

## ملاحظات Phase 4 (Suppliers + Purchases)

عند إضافة الـ 4 models الجديدة:
- إضافة relations في `Store`: `suppliers Supplier[]`, `purchases Purchase[]`
- إضافة relations في `User`:
  - `suppliersCreated Supplier[] @relation("SupplierCreatedBy")`
  - `supplierTransactionsCreated SupplierTransaction[] @relation("SupplierTxCreatedBy")`
  - `supplierTransactionsCancelled SupplierTransaction[] @relation("SupplierTxCancelledBy")`
  - `purchasesCreated Purchase[] @relation("PurchaseCreatedBy")`
  - `purchasesCancelled Purchase[] @relation("PurchaseCancelledBy")`
- سيتم إنشاء migration باسم `p4_suppliers_purchases`

## القواعد المعمارية على Schema

- **IDs**: `cuid()` فقط (T22)
- **Timestamps**: `createdAt @default(now())` + `updatedAt @updatedAt` + snake_case `@map`
- **Money**: `Decimal @db.Decimal(14, 2)` — لا Float أبداً
- **Soft delete**: `deletedAt DateTime?` على الكيانات المالية
- **Indexes**: على storeId + status + foreign keys + dates للاستعلامات الزمنية
