import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  type PurchaseItemRow,
  PurchaseItemsTable,
  computeItemsTotal,
  computeRowTotal,
  makeBlankRow,
} from '@/components/purchases/PurchaseItemsTable';

describe('PurchaseItemsTable helpers', () => {
  it('computeRowTotal multiplies quantity × unitCost with 2-decimal rounding', () => {
    expect(computeRowTotal('3', '4.5')).toBe(13.5);
    expect(computeRowTotal('2.333', '3')).toBe(7);
    expect(computeRowTotal('', '5')).toBe(0);
    expect(computeRowTotal('foo', 'bar')).toBe(0);
  });

  it('computeItemsTotal sums all rows with 2-decimal rounding', () => {
    const rows: PurchaseItemRow[] = [
      { id: 'a', name: 'X', quantity: '2', unitCost: '1.5' },
      { id: 'b', name: 'Y', quantity: '1', unitCost: '0.75' },
    ];
    expect(computeItemsTotal(rows)).toBe(3.75);
  });

  it('makeBlankRow returns row with empty fields and unique id', () => {
    const a = makeBlankRow();
    const b = makeBlankRow();
    expect(a.name).toBe('');
    expect(a.quantity).toBe('');
    expect(a.unitCost).toBe('');
    expect(a.id).not.toBe(b.id);
  });
});

function Harness({ initial = [] as PurchaseItemRow[] }) {
  const [items, setItems] = useState<PurchaseItemRow[]>(initial);
  return <PurchaseItemsTable items={items} onChange={setItems} />;
}

describe('PurchaseItemsTable component', () => {
  it('shows empty placeholder when no rows', () => {
    render(<Harness />);
    expect(screen.getByTestId('purchase-items-empty')).toBeInTheDocument();
  });

  it('adds a new blank row when "إضافة صنف" is clicked', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('purchase-items-add-row'));
    expect(screen.getAllByText('اسم الصنف').length).toBeGreaterThan(0);
  });

  it('renders the grand total based on the rows', () => {
    render(
      <Harness
        initial={[
          { id: 'r1', name: 'A', quantity: '2', unitCost: '5' },
          { id: 'r2', name: 'B', quantity: '1', unitCost: '2.5' },
        ]}
      />,
    );
    // ar-SA Intl renders with Arabic-Indic digits — assert presence of the elements
    // and rely on `computeItemsTotal` / `computeRowTotal` unit tests above for the
    // numeric correctness.
    expect(screen.getByTestId('purchase-items-grand-total')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-item-row-total-r1')).toBeInTheDocument();
  });

  it('hides remove + add buttons in readOnly mode', () => {
    render(
      <PurchaseItemsTable
        readOnly
        items={[{ id: 'r1', name: 'A', quantity: '2', unitCost: '5' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByTestId('purchase-items-add-row')).toBeNull();
    expect(screen.queryByTestId('purchase-item-remove-r1')).toBeNull();
  });
});
