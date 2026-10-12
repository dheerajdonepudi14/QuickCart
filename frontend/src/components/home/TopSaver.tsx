'use client';

import Link from 'next/link';
import { useTopSavers } from '@/lib/hooks';
import ProductCard, { ProductCardSkeleton } from '../product/ProductCard';
import Countdown from './Countdown';

export default function TopSaver() {
  const { data, isLoading, isError, refetch } = useTopSavers(9);
  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <h2 className="section-title">Top Saver Today</h2>
          <Countdown />
        </div>
        <Link href="/search?sort=discount" className="link-underline">View All</Link>
      </div>
      {isError ? (
        <div className="rounded-lg bg-red-50 p-6 text-sm text-danger">
          Couldn&apos;t load today&apos;s deals. <button onClick={() => refetch()} className="font-bold underline">Retry</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading || !data
            ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : data.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}
