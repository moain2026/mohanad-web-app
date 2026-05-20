/**
 * Auth API client — sessions endpoints (Phase-2 polish).
 *
 * Other auth endpoints (login / refresh / logout / change-password) are
 * driven through `useAuthStore` directly because they hold session state.
 * Sessions list / revoke is a purely server-side resource, so we expose
 * it through plain typed wrappers + React-Query.
 */

import { apiGet, apiPost } from '../api';

export interface AuthSession {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  rememberMe: boolean;
  /** ISO string. */
  createdAt: string;
  /** ISO string. */
  expiresAt: string;
  /** True for the session matching the caller's current refresh cookie. */
  current: boolean;
}

export const authApi = {
  /** GET /auth/sessions — active sessions for the current user. */
  listSessions: () => apiGet<{ sessions: AuthSession[] }>('/auth/sessions'),

  /** POST /auth/sessions/:id/revoke — revoke a single session. */
  revokeSession: (sessionId: string) =>
    apiPost<{ ok: true; revoked: true }, never>(`/auth/sessions/${sessionId}/revoke`),
};
