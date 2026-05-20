/**
 * Notification Templates API client (Phase 8).
 */
import type { CreateTemplateInput, UpdateTemplateInput } from '@grocery/shared';

import { apiDelete, apiGet, apiPatch, apiPost } from '../api';

export interface NotificationTemplate {
  id: string;
  storeId: string;
  key: string;
  name: string;
  channel: 'INTERNAL' | 'WHATSAPP';
  bodyTemplate: string;
  placeholdersJson: string[];
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; username: string; fullName: string };
  updatedBy?: { id: string; username: string; fullName: string } | null;
}

export const templatesApi = {
  list: (params?: { channel?: 'INTERNAL' | 'WHATSAPP'; isActive?: boolean }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : '';
    return apiGet<NotificationTemplate[]>(`/notification-templates${qs}`);
  },
  get: (id: string) => apiGet<NotificationTemplate>(`/notification-templates/${id}`),
  create: (body: CreateTemplateInput) =>
    apiPost<NotificationTemplate, CreateTemplateInput>('/notification-templates', body),
  update: (id: string, body: UpdateTemplateInput) =>
    apiPatch<NotificationTemplate, UpdateTemplateInput>(`/notification-templates/${id}`, body),
  delete: (id: string) => apiDelete<{ ok: true }>(`/notification-templates/${id}`),
};

// Password reset
export const passwordResetsApi = {
  request: (username: string) =>
    apiPost<{ ok: true; devToken?: string }, { username: string }>('/auth/password-reset/request', {
      username,
    }),
  confirm: (token: string, newPassword: string) =>
    apiPost<{ ok: true }, { token: string; newPassword: string }>('/auth/password-reset/confirm', {
      token,
      newPassword,
    }),
};
