'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys, useHydrated } from '@/lib/hooks';
import { useStoreId } from '@/store/useLocationStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import ProductCard, { ProductCardSkeleton } from '@/components/product/ProductCard';
import EmptyState from '@/components/ui/EmptyState';

export default function WishlistPage() {
  const hydrated = useHydrated();
  const ids = useWishlistStore((s) => s.ids);
  const storeId = useStoreId();
  const results = useQueries({
    queries: (hydrated ? ids : []).map((id) => ({
      queryKey: queryKeys.product(storeId, id),
      queryFn: () => api.catalog.product(storeId as number, id),
      enabled: storeId !== null,
      staleTime: 60_000,
    })),
  });

  return (
    <div className="container pt-6">
      <h1 className="mb-6 font-display text-2xl font-bold">My Wishlist</h1>
      {hydrated && ids.length === 0 ? (
        <EmptyState emoji="💚" title="No favourites yet" text="Tap the heart on any product to save it here." action={<Link href="/" className="btn-primary">Explore products</Link>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r, i) =>
            r.data ? <ProductCard key={ids[i]} product={r.data.product} /> : r.isError ? null : <ProductCardSkeleton key={ids[i]} />,
          )}
        </div>
      )}
    </div>
  );
}
