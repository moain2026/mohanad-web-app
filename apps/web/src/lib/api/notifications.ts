/**
 * Notifications API client (Phase 3 Frontend).
 */

import type { ListNotificationsQuery } from '@grocery/shared';

import { apiGet, apiPost } from '../api';
import type { Paged } from './customers';

export type NotificationType =
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'GRACE_PERIOD_ENDING'
  | 'CUSTOMER_INACTIVE'
  | 'CUSTOMER_DEBT_HIGH';

export interface Notification {
  id: string;
  userId: string | null;
  storeId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  sentAt: string;
}

export const notificationsApi = {
  list: (params: Partial<ListNotificationsQuery> = {}) =>
    apiGet<Paged<Notification>>('/notifications', { params }),

  unreadCount: () => apiGet<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiPost<{ ok: true; alreadyRead?: boolean }, never>(`/notifications/${id}/read`),

  markAllRead: () => apiPost<{ ok: true; updated: number }, never>('/notifications/read-all'),
};
