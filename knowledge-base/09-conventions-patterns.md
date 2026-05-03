# 09 — الأنماط والاتفاقيات الواجب اتباعها

## Backend Patterns (NestJS)

### Service Pattern
```typescript
interface XxxScope {
  storeId: string;
  actorId: string;
  permissions?: string[]; // optional — للـ over-limit checks
}

@Injectable()
export class XxxService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: XxxScope, input: CreateXxxInput) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.xxx.create({...});
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'xxx',
          entityId: row.id,
          newValues: {...},
        },
      });
      return row;
    });
  }
}
```

### Controller Pattern
```typescript
@ApiTags('Xxx')
@ApiBearerAuth('access-token')
@Controller('xxx')
export class XxxController {
  constructor(private readonly xxx: XxxService) {}

  @Get()
  @RequirePermission('xxx.view')
  @UsePipes(new ZodValidationPipe(listXxxQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListXxxQuery) {
    return this.xxx.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  @Post()
  @RequirePermission('xxx.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createXxxSchema))
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateXxxInput) {
    return this.xxx.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }
}
```

### Errors Pattern
```typescript
throw new NotFoundException({
  message: 'العميل غير موجود',
  code: 'CUSTOMER_NOT_FOUND',
});

throw new ConflictException({
  message: 'العميل مُجمَّد — لا يمكن تسجيل دين',
  code: 'CUSTOMER_FROZEN',
});

throw new BadRequestException({
  message: 'المبلغ يجب أن يكون أكبر من الصفر',
  code: 'INVALID_AMOUNT',
});

throw new ForbiddenException({
  message: 'لا تملك صلاحية الموافقة على تجاوز سقف الدين',
  code: 'PERMISSION_DENIED',
});
```

### SELECT FOR UPDATE Pattern (للأرصدة)
```typescript
const [row] = await tx.$queryRaw<Array<{ id: string; current_balance: string }>>`
  SELECT id, current_balance FROM suppliers
  WHERE id = ${dto.supplierId} AND store_id = ${scope.storeId} AND deleted_at IS NULL
  FOR UPDATE
`;
if (!row) throw new NotFoundException({ message: '...', code: 'SUPPLIER_NOT_FOUND' });
const before = Number(row.current_balance);
const after = before + amount;
await tx.supplier.update({ where: { id: row.id }, data: { currentBalance: after } });
```

### Cancel/Reverse Pattern
```typescript
const reverseDelta =
  original.type === 'PAYMENT' ? Number(original.amount) : -Number(original.amount);
// ... apply inverse to balance, mark cancelledAt + cancelledById + cancelReason
```

## Frontend Patterns (React + TanStack Query)

### API Client Pattern
```typescript
// apps/web/src/lib/api/customers.ts
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@grocery/shared';

export const customersApi = {
  list: (params: ListParams) =>
    apiGet<{ items: Customer[]; meta: PaginationMeta }>('/customers', { params }),
  get: (id: string) => apiGet<Customer>(`/customers/${id}`),
  create: (data: CreateCustomerInput, idempotencyKey?: string) =>
    apiPost<Customer, CreateCustomerInput>('/customers', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  update: (id: string, data: UpdateCustomerInput) =>
    apiPatch<Customer, UpdateCustomerInput>(`/customers/${id}`, data),
  delete: (id: string) => apiDelete<{ ok: true }>(`/customers/${id}`),
  freeze: (id: string) => apiPost<Customer, never>(`/customers/${id}/freeze`),
  unfreeze: (id: string) => apiPost<Customer, never>(`/customers/${id}/unfreeze`),
  grantGrace: (id: string, until: Date) =>
    apiPost<Customer, { graceUntil: string }>(`/customers/${id}/grant-grace`, {
      graceUntil: until.toISOString(),
    }),
  setCreditLimit: (id: string, limit: number | null) =>
    apiPost<Customer, { creditLimit: number | null }>(`/customers/${id}/credit-limit`, {
      creditLimit: limit,
    }),
  getBalance: (id: string) => apiGet<BalanceInfo>(`/customers/${id}/balance`),
  getStatement: (id: string, params: { page?: number; limit?: number }) =>
    apiGet<Statement>(`/customers/${id}/statement`, { params }),
};
```

### TanStack Query Hooks Pattern
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/customers';

export const customersKeys = {
  all: ['customers'] as const,
  lists: () => [...customersKeys.all, 'list'] as const,
  list: (params: ListParams) => [...customersKeys.lists(), params] as const,
  details: () => [...customersKeys.all, 'detail'] as const,
  detail: (id: string) => [...customersKeys.details(), id] as const,
  statement: (id: string, params: any) => [...customersKeys.detail(id), 'statement', params] as const,
  balance: (id: string) => [...customersKeys.detail(id), 'balance'] as const,
};

export function useCustomersList(params: ListParams) {
  return useQuery({
    queryKey: customersKeys.list(params),
    queryFn: () => customersApi.list(params),
    staleTime: 30_000,
  });
}

export function useAddDebt(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDebtInput) =>
      customerTransactionsApi.createDebt(customerId, input, crypto.randomUUID()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customersKeys.detail(customerId) });
      qc.invalidateQueries({ queryKey: customersKeys.balance(customerId) });
    },
  });
}
```

### Page Pattern
```tsx
import { IonPage, IonContent } from '@ionic/react';
import { PageHeader } from '@/components/layout/PageHeader';
// ...

export function CustomersListPage(): JSX.Element {
  // hooks ...
  return (
    <IonPage>
      <PageHeader title="العملاء" actions={<AddCustomerButton />} />
      <IonContent>
        {/* search + filters + list */}
      </IonContent>
    </IonPage>
  );
}
```

### Modal Pattern (ResponsiveDialog)
```tsx
<ResponsiveDialog open={open} onClose={onClose} title="تسجيل دين">
  <form onSubmit={handleSubmit(onSubmit)}>
    <Input {...register('amount')} type="number" inputMode="decimal" />
    <BalancePreview before={current} delta={watchedAmount} />
    {willExceedLimit && <CreditLimitWarning ... />}
    <Button type="submit" loading={mutation.isPending}>تأكيد</Button>
  </form>
</ResponsiveDialog>
```

### Permission Gate Pattern
```tsx
<PermissionGate permission="customers.create">
  <Button>إنشاء عميل</Button>
</PermissionGate>

<PermissionGate anyOf={['customers.delete', 'customers.restore']}>
  <DangerActions />
</PermissionGate>
```

### Idempotency Key Generation
```typescript
const idempotencyKey = crypto.randomUUID();
// pass via headers
```

## Naming & File Patterns

| Type | Convention | Example |
|------|-----------|---------|
| React component file | PascalCase | `CustomerCard.tsx` |
| Page file | PascalCase + `Page` suffix | `CustomersListPage.tsx` |
| API client file | kebab/camel | `customers.ts` |
| Hook file | camelCase + `use` prefix | `useCustomers.ts` |
| Test file | `.test.tsx` (web) / `.spec.ts` (api) | `BalanceDisplay.test.tsx` |
| Permission code | snake.dot | `customer_transactions.create_debt` |
| API path | kebab | `/customer-transactions/debt` |
| Error code | UPPER_SNAKE | `CUSTOMER_FROZEN` |

## Forms (RHF + Zod)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema, type CreateCustomerInput } from '@grocery/shared';

const { register, handleSubmit, formState: { errors } } = useForm<CreateCustomerInput>({
  resolver: zodResolver(createCustomerSchema),
  defaultValues: { name: '', phone: undefined, openingBalance: 0 },
});
```

## Numbers & Decimals

- في الـ UI: `tabular-nums` + `direction: ltr` للأرقام
- لا تستخدم `Number(decimalString)` بدون التأكد من الـ precision — استخدم `parseDecimal()` من `@grocery/shared`
- في الفورمات: `inputMode="decimal"` للأرقام الكسرية

## Color Coding (Balance)

```typescript
function balanceColor(balance: number): string {
  if (balance > 0) return 'text-danger';   // red — العميل مدين للبقالة
  if (balance < 0) return 'text-info';     // blue — البقالة مدينة للعميل
  return 'text-success';                    // green — متعادل
}
```
