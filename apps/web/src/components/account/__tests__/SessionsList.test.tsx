import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionsList } from '@/components/account/SessionsList';
import type { AuthSession } from '@/lib/api/auth';
import { renderWithProviders } from '@/test/render-with-providers';

// ─── Module mocks ───────────────────────────────────────────────
const listSessionsMock = vi.fn();
const revokeSessionMock = vi.fn();

vi.mock('@/lib/api/auth', () => ({
  authApi: {
    listSessions: (...args: unknown[]) => listSessionsMock(...args),
    revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
  },
}));

// ─── Fixtures ───────────────────────────────────────────────────
const baseSessionA: AuthSession = {
  id: 'rt-current',
  deviceLabel: null,
  ipAddress: '10.0.0.1',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  rememberMe: true,
  createdAt: new Date('2026-05-19T10:00:00Z').toISOString(),
  expiresAt: new Date('2026-05-26T10:00:00Z').toISOString(),
  current: true,
};

const baseSessionB: AuthSession = {
  id: 'rt-other',
  deviceLabel: 'Office Laptop',
  ipAddress: '192.168.1.5',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
  rememberMe: false,
  createdAt: new Date('2026-05-18T08:00:00Z').toISOString(),
  expiresAt: new Date('2026-05-25T08:00:00Z').toISOString(),
  current: false,
};

describe('<SessionsList />', () => {
  beforeEach(() => {
    listSessionsMock.mockReset();
    revokeSessionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons while data is in-flight', () => {
    listSessionsMock.mockReturnValue(new Promise(() => undefined)); // never resolves
    renderWithProviders(<SessionsList />);
    expect(screen.getByTestId('sessions-loading')).toBeInTheDocument();
  });

  it('shows an empty state when the server returns no sessions', async () => {
    listSessionsMock.mockResolvedValue({ sessions: [] });
    renderWithProviders(<SessionsList />);
    expect(await screen.findByText(/لا توجد جلسات نشطة/)).toBeInTheDocument();
  });

  it('renders rows + flags the current session with هذا الجهاز', async () => {
    listSessionsMock.mockResolvedValue({ sessions: [baseSessionA, baseSessionB] });
    renderWithProviders(<SessionsList />);

    // List renders
    await screen.findByTestId('sessions-list');
    expect(screen.getByTestId('sessions-count-badge').textContent).toBe('2');

    // Current row has data-current=true and the هذا الجهاز badge
    const currentRow = screen.getByTestId(`session-row-${baseSessionA.id}`);
    expect(currentRow.dataset.current).toBe('true');
    expect(within(currentRow).getByText('هذا الجهاز')).toBeInTheDocument();
    // Current row must NOT expose a revoke button (use Logout instead)
    expect(screen.queryByTestId(`revoke-session-${baseSessionA.id}`)).not.toBeInTheDocument();

    // Other row has data-current=false and a revoke button
    const otherRow = screen.getByTestId(`session-row-${baseSessionB.id}`);
    expect(otherRow.dataset.current).toBe('false');
    expect(within(otherRow).getByText('Office Laptop')).toBeInTheDocument();
    expect(screen.getByTestId(`revoke-session-${baseSessionB.id}`)).toBeInTheDocument();
  });

  it('revokes a non-current session via the confirm dialog', async () => {
    const user = userEvent.setup();
    listSessionsMock.mockResolvedValueOnce({ sessions: [baseSessionA, baseSessionB] });
    revokeSessionMock.mockResolvedValueOnce({ ok: true, revoked: true });
    // After successful revoke, the list is refetched without the other session
    listSessionsMock.mockResolvedValueOnce({ sessions: [baseSessionA] });

    renderWithProviders(<SessionsList />);

    // Click revoke on the non-current session
    const revokeBtn = await screen.findByTestId(`revoke-session-${baseSessionB.id}`);
    await user.click(revokeBtn);

    // ConfirmDialog appears
    const dialogTitle = await screen.findByText('إنهاء الجلسة؟');
    expect(dialogTitle).toBeInTheDocument();

    // Confirm — there are TWO buttons with "إنهاء الجلسة" text (the row
    // button and the dialog's confirm button). The dialog confirm is
    // the danger-styled one in the modal — find it via the modal's role.
    const dialog = dialogTitle.closest('[role="dialog"]') as HTMLElement | null;
    expect(dialog).not.toBeNull();
    const confirmBtn = within(dialog as HTMLElement).getByRole('button', {
      name: 'إنهاء الجلسة',
    });
    await user.click(confirmBtn);

    // Mutation called with the right id
    await waitFor(() => {
      expect(revokeSessionMock).toHaveBeenCalledWith(baseSessionB.id);
    });

    // After invalidation, the list should refetch and only the current session remains
    await waitFor(() => {
      expect(screen.queryByTestId(`session-row-${baseSessionB.id}`)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(`session-row-${baseSessionA.id}`)).toBeInTheDocument();
  });

  it('shows an error state when the list query fails', async () => {
    listSessionsMock.mockRejectedValueOnce({
      response: {
        data: { meta: { error: { message: 'الخادم غير متاح' } } },
      },
    });
    renderWithProviders(<SessionsList />);
    expect(await screen.findByText('تعذر تحميل الجلسات')).toBeInTheDocument();
    expect(screen.getByText('الخادم غير متاح')).toBeInTheDocument();
  });

  it('refetches when the refresh button is clicked', async () => {
    const user = userEvent.setup();
    listSessionsMock.mockResolvedValue({ sessions: [baseSessionA] });
    renderWithProviders(<SessionsList />);

    // Initial fetch + render
    await screen.findByTestId(`session-row-${baseSessionA.id}`);
    expect(listSessionsMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('sessions-refresh'));

    await waitFor(() => {
      expect(listSessionsMock).toHaveBeenCalledTimes(2);
    });
  });
});
