'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SortKey } from '@/lib/types';
import { useStoreId } from '@/store/useLocationStore';
import ProductCard, { ProductCardSkeleton } from './ProductCard';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name (A–Z)' },
];

interface Props {
  category?: string;
  q?: string;
  sort: SortKey;
  onTotal?: (n: number) => void;
  columns?: string;
}

export default function InfiniteProductGrid({ category, q, sort, onTotal, columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' }: Props) {
  const storeId = useStoreId();
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery({
    queryKey: ['products-infinite', storeId, category ?? '', q ?? '', sort],
    queryFn: ({ pageParam }) => api.catalog.products(storeId as number, { category, q, sort, page: pageParam, size: 20 }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
    enabled: storeId !== null,
    staleTime: 20_000,
  });

  const total = query.data?.pages[0]?.totalElements;
  useEffect(() => {
    if (total !== undefined) onTotal?.(total);
  }, [total, onTotal]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isError) {
    return (
      <EmptyState emoji="⚠️" title="Couldn't load products" text={(query.error as Error).message}
        action={<button onClick={() => query.refetch()} className="btn-primary">Retry</button>} />
    );
  }

  const products = query.data?.pages.flatMap((p) => p.content) ?? [];
  if (!query.isLoading && storeId !== null && products.length === 0) {
    return <EmptyState emoji="🔍" title="Nothing here yet" text={q ? `We couldn't find anything for “${q}”. Try a different word or brand.` : 'This aisle is empty at your dark store right now.'} />;
  }

  return (
    <>
      <div className={`grid gap-3 md:gap-4 ${columns}`}>
        {query.isLoading || storeId === null
          ? Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} layout="grid" />)
          : products.map((p) => <ProductCard key={p.id} product={p} layout="grid" />)}
      </div>
      <div ref={sentinel} className="flex h-16 items-center justify-center">
        {isFetchingNextPage && <Spinner className="text-brand-500" />}
        {!hasNextPage && products.length > 20 && <p className="text-xs text-ink-muted">You&apos;ve reached the end of the aisle 🌿</p>}
      </div>
    </>
  );
}
