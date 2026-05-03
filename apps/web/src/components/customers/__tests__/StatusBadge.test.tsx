import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '@/components/customers/StatusBadge';

describe('StatusBadge', () => {
  it('renders ACTIVE label', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });

  it('renders FROZEN label', () => {
    render(<StatusBadge status="FROZEN" />);
    expect(screen.getByText('مجمَّد')).toBeInTheDocument();
  });

  it('renders GRACE_PERIOD with date suffix when graceUntil supplied', () => {
    render(
      <StatusBadge
        status="GRACE_PERIOD"
        graceUntil={new Date('2026-12-31T00:00:00Z').toISOString()}
      />,
    );
    expect(screen.getByText(/مهلة سداد/)).toBeInTheDocument();
  });
});
