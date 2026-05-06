/**
 * Purchases API client (Phase 4 Frontend).
 *
 * One create endpoint handles both CASH and CREDIT (the body's `paymentType`
 * picks the path on the server). Cancellation is also a single endpoint —
 * the service decides whether to reverse supplier balance based on the
 * stored `paymentType`.
 */

import type { CancelPurchaseInput, CreatePurchaseInput, ListPurchasesQuery } from '@grocery/shared';

import { apiGet, apiPost } from '../api';

// ─── Types ─────────────────────────────────────────────────────────
export type PurchasePaymentType = 'CASH' | 'CREDIT';

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string | null;
  name: string;
  quantity: string | number;
  unitCost: string | number;
  totalCost: string | number;
  createdAt: string;
}

export interface Purchase {
  id: string;
  storeId: string;
  supplierId: string;
  paymentType: PurchasePaymentType;
  totalAmount: string | number;
  notes: string | null;
  hasItems: boolean;
  cancelledAt: string | null;
  cancelledById: string | null;
  cancelReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt?: string;
  supplier?: { id: string; name: string; phone: string | null };
  items?: PurchaseItem[];
  createdBy?: { id: string; username: string; fullName: string };
  cancelledBy?: { id: string; username: string; fullName: string } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PaginationMeta;
}

// ─── Purchases API ─────────────────────────────────────────────────
export const purchasesApi = {
  list: (params: Partial<ListPurchasesQuery> = {}) =>
    apiGet<Paged<Purchase>>('/purchases', { params }),

  get: (id: string) => apiGet<Purchase>(`/purchases/${id}`),

  create: (data: CreatePurchaseInput) => apiPost<Purchase, CreatePurchaseInput>('/purchases', data),

  cancel: (id: string, data: CancelPurchaseInput) =>
    apiPost<Purchase, CancelPurchaseInput>(`/purchases/${id}/cancel`, data),
};
