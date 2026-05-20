import { Trash2 } from 'lucide-react';

import { formatSupplierBalance, toNumber } from '@/components/suppliers/SupplierBalanceDisplay';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

/**
 * SaleItemRow — same string-input pattern as PurchaseItemRow to keep typing
 * snappy. Coerced to numbers at submit time only.
 */
export interface SaleItemRow {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

export interface SaleItemsTableProps {
  items: SaleItemRow[];
  onChange: (items: SaleItemRow[]) => void;
  readOnly?: boolean;
}

export function computeRowTotal(quantity: string, unitPrice: string): number {
  const q = toNumber(quantity);
  const u = toNumber(unitPrice);
  return Number((q * u).toFixed(2));
}

export function computeItemsTotal(items: SaleItemRow[]): number {
  return Number(
    items.reduce((acc, it) => acc + computeRowTotal(it.quantity, it.unitPrice), 0).toFixed(2),
  );
}

let __idCounter = 0;
function nextRowId(): string {
  __idCounter += 1;
  return `sale-row-${Date.now()}-${__idCounter}`;
}

export function makeBlankRow(): SaleItemRow {
  return { id: nextRowId(), name: '', quantity: '', unitPrice: '' };
}

/**
 * SaleItemsTable — editable item list for DETAILED / CREDIT sales.
 * Mirrors PurchaseItemsTable's UX but uses `unitPrice` (not unitCost).
 */
export function SaleItemsTable({ items, onChange, readOnly }: SaleItemsTableProps): JSX.Element {
  const updateRow = (id: string, patch: Partial<SaleItemRow>) => {
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
    <div className="space-y-3" data-testid="sale-items-table">
      <div className="hidden md:grid md:grid-cols-12 md:gap-2 text-xs font-semibold text-gray-500 px-1">
        <span className="col-span-5">اسم الصنف</span>
        <span className="col-span-2 text-center">الكمية</span>
        <span className="col-span-2 text-center">سعر البيع</span>
        <span className="col-span-2 text-center">الإجمالي</span>
        <span className="col-span-1" />
      </div>

      <ul className="space-y-2">
        {items.map((row) => {
          const lineTotal = computeRowTotal(row.quantity, row.unitPrice);
          return (
            <li
              key={row.id}
              className={cn(
                'rounded-lg border border-gray-100 bg-white p-3',
                'grid grid-cols-1 gap-2 md:grid-cols-12 md:items-end',
              )}
              data-testid={`sale-item-row-${row.id}`}
            >
              <div className="md:col-span-5">
                <Input
                  label="اسم الصنف"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  disabled={readOnly}
                  placeholder="مثال: شاي ليبتون كبير"
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
                  label="سعر البيع"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={row.unitPrice}
                  onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="md:col-span-2 flex flex-col items-start md:items-center">
                <span className="text-xs text-gray-500">الإجمالي</span>
                <span
                  className="text-sm font-bold text-ink tabular-nums"
                  data-testid={`sale-item-row-total-${row.id}`}
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
                    data-testid={`sale-item-remove-${row.id}`}
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
          data-testid="sale-items-empty"
        >
          لا توجد أصناف بعد — يمكنك تسجيل البيع بإجمالي فقط، أو إضافة أصناف للتفصيل.
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRow}
            data-testid="sale-items-add-row"
          >
            + إضافة صنف
          </Button>
          <div className="text-sm">
            <span className="text-gray-500">إجمالي الأصناف: </span>
            <span className="font-bold tabular-nums text-ink" data-testid="sale-items-grand-total">
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
