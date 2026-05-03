# 04 — حالة Backend Modules (NestJS API)

## المسجلة في `app.module.ts`

| Module | الحالة | الـ Controllers | الـ Services |
|--------|--------|----------------|--------------|
| `HealthModule` | ✅ | `health.controller.ts` (`/api/v1/health`) | — |
| `AuthModule` | ✅ Phase 2 | `auth.controller.ts` | `auth.service.ts`, `token.service.ts` |
| `UsersModule` | ✅ Phase 2 | `users.controller.ts` | `users.service.ts` |
| `RolesModule` | ✅ Phase 2 | `roles.controller.ts` | `roles.service.ts` |
| `PermissionsModule` | ✅ Phase 2 | `permissions.controller.ts` | `permissions.service.ts` |
| `CustomersModule` | ✅ Phase 3 | `customers.controller.ts` + `customer-transactions.controller.ts` | `customers.service.ts` + `customer-transactions.service.ts` |
| `NotificationsModule` | ✅ Phase 3 | `notifications.controller.ts` | `notifications.service.ts` |
| `PrismaModule` | ✅ | `prisma.service.ts` (Global) | — |

## Globals

- `APP_GUARD`: `ThrottlerGuard` (100 req/min، 5/15min على /auth/login)
- `APP_FILTER`: `AllExceptionsFilter`
- `APP_INTERCEPTOR`: `ResponseFormatInterceptor` (envelope `{data, meta}`)
- `JwtModule.register({ global: true })` — لإمكانية decode في الميدلوير

## Middleware Chain (بالترتيب)

1. `RequestIdMiddleware` — يولد X-Request-Id لكل request
2. `IdempotencyMiddleware` — يفحص key + يخزن استجابات 2xx لمدة 24h

## Auth Module — Routes

- `POST /api/v1/auth/login` — public, sets refresh cookie `grocery_refresh`
- `POST /api/v1/auth/refresh` — cookie-gated, rotates token
- `POST /api/v1/auth/logout` — auth, revokes current session
- `POST /api/v1/auth/logout-all` — auth
- `GET /api/v1/auth/me` — auth
- `POST /api/v1/auth/change-password` — auth, revokes all sessions

## Users Module — Routes

- `GET /api/v1/users` — list paginated
- `POST /api/v1/users` — create (Idempotency-Key)
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`
- `DELETE /api/v1/users/:id` — soft delete
- `POST /api/v1/users/:id/reset-password`
- `POST /api/v1/users/:id/activate` / `deactivate`
- `POST /api/v1/users/:id/roles` — assign
- `GET /api/v1/users/:id/effective-permissions`

## Roles Module — Routes

- CRUD + clone + setPermissions
- System role guardrails: `SYSTEM_ROLE_UNDELETABLE` / `SYSTEM_ROLE_RENAME_FORBIDDEN`

## Permissions Module — Routes

- `GET /api/v1/permissions` — catalog ديناميكي مجموع حسب module

## Customers Module — Routes (✅ Phase 3 Backend)

### `customers.controller.ts` (`/api/v1/customers`)
- `GET /` — list (paginated + search + status filter + hasDebt filter) [permission: `customers.view`]
- `GET /:id` — detail [permission: `customers.view`]
- `GET /:id/balance` — balance only [permission: `customers.view_balance`]
- `GET /:id/statement?page&limit` — statement (balance + paginated tx) [permission: `customers.view_transactions`]
- `POST /` — create + opening balance ledger row [permission: `customers.create`]
- `PATCH /:id` — update basic fields [permission: `customers.update`]
- `DELETE /:id` — soft delete (يرفض إن الرصيد ≠ 0 → `CUSTOMER_HAS_BALANCE`) [permission: `customers.delete`]
- `POST /:id/freeze` — تجميد [permission: `customers.freeze`]
- `POST /:id/unfreeze` — إلغاء تجميد [permission: `customers.unfreeze`]
- `POST /:id/grant-grace` — منح مهلة [permission: `customers.grant_grace`]
- `POST /:id/credit-limit` — تحديد سقف [permission: `customers.set_credit_limit`]

### `customer-transactions.controller.ts` (`/api/v1/customers/:id/transactions`)
- `GET /` — list per customer (filters: type, includeCancelled) [permission: `customer_transactions.view`]
- `POST /debt` — create DEBT (atomic + credit-limit check) [permission: `customer_transactions.create_debt`]
- `POST /payment` — create PAYMENT (atomic) [permission: `customer_transactions.create_payment`]
- `POST /adjustment` — create ADJUSTMENT [permission: `customer_transactions.create_adjustment`]
- `POST /:txId/cancel` — cancel + reverse balance [permission: `customer_transactions.cancel`]

## Notifications Module — Routes (✅ Phase 3 Backend)

`/api/v1/notifications`
- `GET /` — feed (paginated + filters: type, unreadOnly) [permission: `notifications.view_own`]
- `GET /unread-count` — للـ bell badge [permission: `notifications.view_own`]
- `POST /:id/read` — mark single [permission: `notifications.mark_read`]
- `POST /read-all` — mark all [permission: `notifications.mark_read`]

## ما المتبقي في Backend (Phase 4)

❌ `SuppliersModule` — لم يبدأ
❌ `SupplierTransactionsModule` — لم يبدأ (سيكون داخل SuppliersModule)
❌ `PurchasesModule` — لم يبدأ
❌ تحديث `app.module.ts` لإضافتهم

## القواعد المعمارية المحفوظة في Phase 3 Backend (وأنماطنا للـ Phase 4)

1. **كل service يأخذ `scope: { storeId, actorId, permissions? }`**
2. **كل write داخل `prisma.$transaction(async (tx) => {...})`**
3. **AuditLog row** بعد كل state change
4. **Errors عربية** + `code` ثابت (`CUSTOMER_FROZEN`, `CREDIT_LIMIT_EXCEEDED`...)
5. **Validation** عبر `ZodValidationPipe(schema, 'body' | 'query')` من `packages/shared`
6. **Decorators**: `@CurrentUser()`, `@RequirePermission('module.action')`, `@Public()` للـ exemptions
7. **Pagination meta**: `{ page, limit, total, totalPages }`
8. **Decimal**: نستخدم `Number()` للحسابات (Prisma Decimal يأتي كـ Decimal class)
9. **Notifications**: `userId = null` = broadcast لكل من له العلاقة في نفس storeId
