/**
 * Settings API client (Phase 7).
 */
import { apiGet, apiPut } from '../api';

export type SettingsMap = Record<string, unknown>;

export const settingsApi = {
  list: () => apiGet<SettingsMap>('/settings'),
  get: (key: string) => apiGet<{ key: string; value: unknown }>(`/settings/${encodeURIComponent(key)}`),
  upsertOne: (key: string, value: unknown) =>
    apiPut<{ key: string; value: unknown }>(`/settings/${encodeURIComponent(key)}`, { key, value }),
  upsertMany: (items: Array<{ key: string; value: unknown }>) =>
    apiPut<SettingsMap>('/settings', { items }),
};
