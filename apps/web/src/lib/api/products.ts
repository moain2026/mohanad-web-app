/**
 * Products + Stock Movements API client (Phase 9).
 */
import type {
  CreateProductInput,
  CreateStockMovementInput,
  UpdateProductInput,
} from '@grocery/shared';

import { apiDelete, apiGet, apiPatch, apiPost } from '../api';

export interface Product {
  id: string;
  storeId: string;
  sku: string | null;
  name: string;
  unit: string;
  category: string | null;
  currentStock: string | number;
  reorderLevel: string | number;
  costPrice: string | number;
  sellPrice: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface StockMovement {
  id: string;
  storeId: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: string | number;
  stockBefore: string | number;
  stockAfter: string | number;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  cancelledAt: string | null;
  createdAt: string;
  product?: { id: string; name: string; unit: string };
  createdBy?: { id: string; username: string; fullName: string };
}

export interface ProductsList {
  items: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface StockSummary {
  total: number;
  active: number;
  archived: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    currentStock: number;
    reorderLevel: number;
    unit: string;
  }>;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const productsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
    includeArchived?: boolean;
  }) => apiGet<ProductsList>(`/products${qs(params ?? {})}`),
  get: (id: string) => apiGet<Product>(`/products/${id}`),
  stockSummary: () => apiGet<StockSummary>('/products/stock-summary'),
  create: (body: CreateProductInput) => apiPost<Product, CreateProductInput>('/products', body),
  update: (id: string, body: UpdateProductInput) =>
    apiPatch<Product, UpdateProductInput>(`/products/${id}`, body),
  archive: (id: string) => apiDelete<{ ok: true }>(`/products/${id}`),
  restore: (id: string) => apiPost<Product>(`/products/${id}/restore`),
};

export const stockMovementsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    productId?: string;
    type?: 'IN' | 'OUT' | 'ADJUST';
    from?: Date;
    to?: Date;
    includeCancelled?: boolean;
  }) => {
    const fixed = {
      ...params,
      from: params?.from ? params.from.toISOString() : undefined,
      to: params?.to ? params.to.toISOString() : undefined,
    };
    return apiGet<{ items: StockMovement[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      `/stock-movements${qs(fixed)}`,
    );
  },
  get: (id: string) => apiGet<StockMovement>(`/stock-movements/${id}`),
  create: (body: CreateStockMovementInput) =>
    apiPost<StockMovement, CreateStockMovementInput>('/stock-movements', body),
  cancel: (id: string, reason: string) =>
    apiPost<StockMovement, { reason: string }>(`/stock-movements/${id}/cancel`, { reason }),
};
