/**
 * Sales API client (Phase 6 Frontend).
 *
 * Single create endpoint handles QUICK / DETAILED / CREDIT — the server
 * dispatches on body.mode.
 */

import type { CancelSaleInput, CreateSaleInput, ListSalesQuery } from '@grocery/shared';

import { apiGet, apiPost } from '../api';
import type { Paged } from './purchases';

export type SaleMode = 'QUICK' | 'DETAILED' | 'CREDIT';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  name: string;
  quantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
  createdAt: string;
}

export interface Sale {
  id: string;
  storeId: string;
  mode: SaleMode;
  customerId: string | null;
  totalAmount: string | number;
  notes: string | null;
  hasItems: boolean;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancelReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt?: string;
  customer?: { id: string; name: string; phone: string | null } | null;
  items?: SaleItem[];
  createdBy?: { id: string; username: string; fullName: string };
  cancelledBy?: { id: string; username: string; fullName: string } | null;
}

export const salesApi = {
  list: (params: Partial<ListSalesQuery> = {}) => apiGet<Paged<Sale>>('/sales', { params }),
  get: (id: string) => apiGet<Sale>(`/sales/${id}`),
  create: (data: CreateSaleInput) => apiPost<Sale, CreateSaleInput>('/sales', data),
  cancel: (id: string, data: CancelSaleInput) =>
    apiPost<Sale, CancelSaleInput>(`/sales/${id}/cancel`, data),
};
