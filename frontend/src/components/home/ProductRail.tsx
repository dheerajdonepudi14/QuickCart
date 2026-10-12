'use client';

import Link from 'next/link';
import { useProducts } from '@/lib/hooks';
import ProductCard, { ProductCardSkeleton } from '../product/ProductCard';

export default function ProductRail({ title, category, subtitle }: { title: string; category: string; subtitle?: string }) {
  const { data, isLoading } = useProducts({ category, size: 10, sort: 'relevance' });
  if (!isLoading && (!data || data.content.length === 0)) return null;
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <Link href={`/browse/${category}`} className="link-underline">View All</Link>
      </div>
      <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {isLoading || !data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[180px] shrink-0"><ProductCardSkeleton layout="grid" /></div>
            ))
          : data.content.map((p) => (
              <div key={p.id} className="w-[180px] shrink-0 snap-start"><ProductCard product={p} layout="grid" /></div>
            ))}
      </div>
    </section>
  );
}
