import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';

/**
 * Row shape used by `PurchaseItemsTable`. We keep raw string inputs in state
 * (numbers are coerced at submit-time) to avoid choppy controlled-input
 * re-renders while the user is typing.
 */
export interface PurchaseItemRow {
  id: string;
  name: string;
  quantity: string;
  unitCost: string;
}

export interface PurchaseItemsTableProps {
  items: PurchaseItemRow[];
  onChange: (items: PurchaseItemRow[]) => void;
  /** When true, the table reads as read-only (used in detail page). */
  readOnly?: boolean;
}

/**
 * Compute the total cost of a single row using `toFixed(2)` to match the
 * server-side rounding inside `purchaseItemSchema.transform`.
 */
export function computeRowTotal(quantity: string, unitCost: string): number {
  const q = toNumber(quantity);
  const u = toNumber(unitCost);
  return Number((q * u).toFixed(2));
}

/** Sum of all row totals — single source of truth for the form's grand total. */
export function computeItemsTotal(items: PurchaseItemRow[]): number {
  return Number(
    items.reduce((acc, it) => acc + computeRowTotal(it.quantity, it.unitCost), 0).toFixed(2),
  );
}

let __idCounter = 0;
function nextRowId(): string {
  __idCounter += 1;
  return `row-${Date.now()}-${__idCounter}`;
}

export function makeBlankRow(): PurchaseItemRow {
  return { id: nextRowId(), name: '', quantity: '', unitCost: '' };
}

/**
 * PurchaseItemsTable — Phase 4 P4-FE.
 *
 *   • Editable list of `PurchaseItem` rows for the New Purchase form.
 *   • Mobile-friendly: switches to stacked card layout under `md`.
 *   • Computes line totals + footer grand-total on every change.
 *   • Read-only mode for the detail page (no add/remove buttons).
 */
export function PurchaseItemsTable({
  items,
  onChange,
  readOnly,
}: PurchaseItemsTableProps): JSX.Element {
  const updateRow = (id: string, patch: Partial<PurchaseItemRow>) => {
    onChange(items.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const removeRow = (id: string) => {
    onChange(items.filter((row) => row.id !== id));
  };
  const addRow = () => {
    onChange([...items, makeBlankRow()]);
  };

  const grandTotal = computeItemsTotal(items);

  return (
    <div className="space-y-3" data-testid="purchase-items-table">
      <div className="hidden md:grid md:grid-cols-12 md:gap-2 text-xs font-semibold text-gray-500 px-1">
        <span className="col-span-5">اسم الصنف</span>
        <span className="col-span-2 text-center">الكمية</span>
        <span className="col-span-2 text-center">سعر الوحدة</span>
        <span className="col-span-2 text-center">الإجمالي</span>
        <span className="col-span-1" />
      </div>

      <ul className="space-y-2">
        {items.map((row) => {
          const lineTotal = computeRowTotal(row.quantity, row.unitCost);
          return (
            <li
              key={row.id}
              className={cn(
                'rounded-lg border border-gray-100 bg-white p-3',
                'grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end',
              )}
              data-testid={`purchase-item-row-${row.id}`}
            >
              <div className="md:col-span-5">
                <Input
                  label="اسم الصنف"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  disabled={readOnly}
                  placeholder="مثال: زيت دوار الشمس 1.5 لتر"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="الكمية"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="سعر الوحدة"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={row.unitCost}
                  onChange={(e) => updateRow(row.id, { unitCost: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="md:col-span-2 flex flex-col items-start md:items-center">
                <span className="text-xs text-gray-500">الإجمالي</span>
                <span
                  className="text-sm font-bold text-ink tabular-nums"
                  data-testid={`purchase-item-row-total-${row.id}`}
                >
                  {formatSupplierBalance(lineTotal, '')}
                </span>
              </div>
              <div className="md:col-span-1 flex items-center justify-end">
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(row.id)}
                    aria-label="حذف الصنف"
                    leftIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                    data-testid={`purchase-item-remove-${row.id}`}
                  >
                    حذف
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {items.length === 0 ? (
        <p
          className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500"
          data-testid="purchase-items-empty"
        >
          لا توجد أصناف بعد — يمكنك تسجيل الفاتورة بإجمالي فقط، أو إضافة أصناف للتفصيل.
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRow}
            data-testid="purchase-items-add-row"
          >
            + إضافة صنف
          </Button>
          <div className="text-sm">
            <span className="text-gray-500">إجمالي الأصناف: </span>
            <span
              className="font-bold tabular-nums text-ink"
              data-testid="purchase-items-grand-total"
            >
              {formatSupplierBalance(grandTotal, '')}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-end">
          <span className="text-gray-500">إجمالي الأصناف: </span>
          <span className="font-bold tabular-nums text-ink">
            {formatSupplierBalance(grandTotal, '')}
          </span>
        </div>
      )}
    </div>
  );
}
