import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupplierStatusBadge } from '@/components/suppliers/SupplierStatusBadge';

describe('SupplierStatusBadge', () => {
  it('renders active state', () => {
    render(<SupplierStatusBadge isActive />);
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });

  it('renders inactive state', () => {
    render(<SupplierStatusBadge isActive={false} />);
    expect(screen.getByText('غير نشط')).toBeInTheDocument();
  });
});
