'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SortKey } from '@/lib/types';
import InfiniteProductGrid, { SORT_OPTIONS } from '@/components/product/InfiniteProductGrid';

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey | null) ?? 'relevance';
  const [total, setTotal] = useState<number | null>(null);

  const setSort = (s: SortKey) => {
    const next = new URLSearchParams(params.toString());
    next.set('sort', s);
    router.replace(`/search?${next.toString()}`);
  };

  return (
    <div className="container pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{q ? <>Results for “{q}”</> : sort === 'discount' ? 'Top Saver Deals' : 'All Products'}</h1>
          <p className="mt-1 text-xs text-ink-muted">{total !== null ? `${total} products at your dark store` : 'Searching…'}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto py-2 text-xs">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <InfiniteProductGrid q={q || undefined} sort={sort} onTotal={setTotal} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container pt-6 text-sm text-ink-muted">Loading…</div>}>
      <SearchResults />
    </Suspense>
  );
}
