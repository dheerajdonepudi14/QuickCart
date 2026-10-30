'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { SortKey } from './types';
import { useCartStore } from '@/store/useCartStore';
import { useLocationStore, useStoreId } from '@/store/useLocationStore';

/** Avoids SSR/localStorage hydration mismatches for persisted Zustand stores. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export const queryKeys = {
  categories: ['categories'] as const,
  products: (storeId: number | null, p: object) => ['products', storeId, p] as const,
  topSavers: (storeId: number | null) => ['top-savers', storeId] as const,
  product: (storeId: number | null, id: number) => ['product', storeId, id] as const,
  quote: (p: object) => ['quote', p] as const,
  me: ['me'] as const,
  orders: ['orders'] as const,
  order: (id: number) => ['order', id] as const,
  addresses: ['addresses'] as const,
  paymentConfig: ['payment-config'] as const,
  coupons: ['coupons'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: api.catalog.categories, staleTime: 30 * 60_000 });
}

export function useProducts(p: { category?: string; q?: string; sort?: SortKey; page?: number; size?: number }, enabled = true) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: queryKeys.products(storeId, p),
    queryFn: () => api.catalog.products(storeId as number, p),
    enabled: storeId !== null && enabled,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useTopSavers(limit = 12) {
  const storeId = useStoreId();
  return useQuery({
    queryKey: queryKeys.topSavers(storeId),
    queryFn: () => api.catalog.topSavers(storeId as number, limit),
    enabled: storeId !== null,
    staleTime: 30_000,
  });
}

export function usePaymentConfig() {
  return useQuery({ queryKey: queryKeys.paymentConfig, queryFn: api.payments.config, staleTime: 5 * 60_000 });
}

export function useCoupons() {
  return useQuery({ queryKey: queryKeys.coupons, queryFn: api.checkout.coupons, staleTime: 5 * 60_000 });
}

/**
 * Live, server-authoritative bill for the current cart. Re-quotes (debounced) whenever the cart, coupon
 * or location changes, and feeds real stock numbers back into the cart store.
 */
export function useCartQuote(couponOverride?: string | null) {
  const items = useCartStore((s) => s.items);
  const storedCoupon = useCartStore((s) => s.couponCode);
  const syncStock = useCartStore((s) => s.syncStock);
  const storeId = useStoreId();
  const lat = useLocationStore((s) => s.latitude);
  const lng = useLocationStore((s) => s.longitude);
  const coupon = couponOverride === undefined ? storedCoupon : couponOverride;

  const payload = useMemo(
    () => ({
      storeId: storeId ?? 0,
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      couponCode: coupon || null,
      latitude: lat,
      longitude: lng,
    }),
    [storeId, items, coupon, lat, lng],
  );
  const debounced = useDebounced(payload, 300);

  const query = useQuery({
    queryKey: queryKeys.quote(debounced),
    queryFn: () => api.checkout.quote(debounced),
    enabled: debounced.storeId > 0 && debounced.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!query.data) return;
    const stock: Record<number, number> = {};
    query.data.lines.forEach((l) => { stock[l.productId] = l.availableQuantity; });
    syncStock(stock);
  }, [query.data, syncStock]);

  return query;
}
