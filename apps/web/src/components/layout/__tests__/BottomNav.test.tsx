/**
 * BottomNav — unit tests (Phase 2 P2-5).
 *
 * Verifies dynamic-tab filtering by permissions:
 *   • Sales Worker  → sees only the tabs whose permission set matches.
 *   • Owner (181 perms) → sees up to `max` tabs (default 5), with the
 *     surplus collapsed into a "More" entry.
 *   • Unauthenticated → only the no-permission tabs (dashboard).
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/authStore';

import { BottomNav } from '../BottomNav';

function login(roles: string[], permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'u',
      fullName: 'مستخدم',
      storeId: 's1',
      roles,
      permissions,
    },
    accessToken: 'tok',
    isAuthenticated: true,
    hasBootstrapped: true,
  });
}

function logout() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    hasBootstrapped: true,
  });
}

function renderNav(props: Parameters<typeof BottomNav>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <BottomNav {...props} />
    </MemoryRouter>,
  );
}

afterEach(() => logout());

describe('BottomNav', () => {
  it('shows only no-permission tabs when unauthenticated', () => {
    logout();
    renderNav();
    expect(screen.getByText('الرئيسية')).toBeInTheDocument();
    expect(screen.queryByText('المبيعات')).not.toBeInTheDocument();
    expect(screen.queryByText('التقارير')).not.toBeInTheDocument();
  });

  it('Sales Worker sees sales/customers but NOT reports/expenses', () => {
    login(['SalesWorker'], ['sales.view', 'sales.create', 'customers.view', 'products.view']);
    renderNav();
    expect(screen.getByText('الرئيسية')).toBeInTheDocument();
    expect(screen.getByText('المبيعات')).toBeInTheDocument();
    expect(screen.getByText('العملاء')).toBeInTheDocument();
    expect(screen.queryByText('التقارير')).not.toBeInTheDocument();
    expect(screen.queryByText('المصاريف')).not.toBeInTheDocument();
  });

  it('Accountant sees expenses + reports but not sales/customers', () => {
    login(['Accountant'], ['expenses.view', 'reports.view']);
    renderNav();
    expect(screen.getByText('الرئيسية')).toBeInTheDocument();
    expect(screen.getByText('المصاريف')).toBeInTheDocument();
    expect(screen.getByText('التقارير')).toBeInTheDocument();
    expect(screen.queryByText('المبيعات')).not.toBeInTheDocument();
    expect(screen.queryByText('العملاء')).not.toBeInTheDocument();
  });

  it('caps at max=5 tabs even when many permissions match (Owner case)', () => {
    login(
      ['Owner'],
      [
        'sales.view',
        'sales.create',
        'customers.view',
        'expenses.view',
        'inventory.view',
        'purchases.view',
        'reports.view',
      ],
    );
    renderNav();
    const links = screen.getAllByRole('link');
    expect(links.length).toBeLessThanOrEqual(5);
    // The overflow "More" entry should appear since the user qualifies
    // for more than the cap.
    expect(screen.getByText('المزيد')).toBeInTheDocument();
  });

  it('respects a custom `max` prop', () => {
    login(['Owner'], ['sales.view', 'customers.view', 'expenses.view', 'reports.view']);
    renderNav({ max: 3 });
    const links = screen.getAllByRole('link');
    expect(links.length).toBeLessThanOrEqual(3);
  });

  it('exposes Notifications tab to a user with notifications.view_own (max=8)', () => {
    login(['Viewer'], ['notifications.view_own']);
    renderNav({ max: 8 });
    expect(screen.getByText('الإشعارات')).toBeInTheDocument();
  });

  it('hides Notifications tab from a user without notifications.view_own', () => {
    login(['Viewer'], ['sales.view']);
    renderNav({ max: 8 });
    expect(screen.queryByText('الإشعارات')).not.toBeInTheDocument();
  });
});
