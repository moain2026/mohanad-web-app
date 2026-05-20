/**
 * Sidebar — unit tests.
 *
 * Verifies the desktop sidebar's permission-aware filtering and that the
 * Phase-3 / Phase-4 / maintenance navigation items are reachable.
 *
 *   • Notifications link visible only with `notifications.view_own`.
 *   • Suppliers + Purchases links visible only with the matching codes.
 *   • Unauthenticated users see only items without permission gates.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/authStore';

import { Sidebar } from '../Sidebar';

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

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => logout());

describe('Sidebar', () => {
  it('shows only no-permission items when unauthenticated', () => {
    logout();
    renderSidebar();
    expect(screen.getByText('الرئيسية')).toBeInTheDocument();
    expect(screen.getByText('حسابي')).toBeInTheDocument();
    expect(screen.queryByText('الموردون')).not.toBeInTheDocument();
    expect(screen.queryByText('المشتريات')).not.toBeInTheDocument();
    expect(screen.queryByText('الإشعارات')).not.toBeInTheDocument();
  });

  it('shows Notifications link when user has notifications.view_own', () => {
    login(['Viewer'], ['notifications.view_own']);
    renderSidebar();
    expect(screen.getByText('الإشعارات')).toBeInTheDocument();
  });

  it('hides Notifications link when user lacks the permission', () => {
    login(['Viewer'], ['customers.view']);
    renderSidebar();
    expect(screen.queryByText('الإشعارات')).not.toBeInTheDocument();
  });

  it('shows Suppliers + Purchases links to a Purchasing Officer', () => {
    login(['PurchasingOfficer'], ['suppliers.view', 'purchases.view']);
    renderSidebar();
    expect(screen.getByText('الموردون')).toBeInTheDocument();
    expect(screen.getByText('المشتريات')).toBeInTheDocument();
  });

  it('hides Suppliers + Purchases links when permissions are missing', () => {
    login(['SalesWorker'], ['sales.view', 'customers.view']);
    renderSidebar();
    expect(screen.queryByText('الموردون')).not.toBeInTheDocument();
    expect(screen.queryByText('المشتريات')).not.toBeInTheDocument();
  });
});
