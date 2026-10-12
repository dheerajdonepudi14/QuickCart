'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useCategories } from '@/lib/hooks';
import { categoryIcon } from '@/lib/icons';
import type { Category, SortKey } from '@/lib/types';
import ProductImage from '@/components/product/ProductImage';
import InfiniteProductGrid, { SORT_OPTIONS } from '@/components/product/InfiniteProductGrid';

export default function BrowsePage({ params }: { params: { category: string } }) {
  const slug = decodeURIComponent(params.category);
  const { data: categories } = useCategories();
  const [sort, setSort] = useState<SortKey>('relevance');
  const [total, setTotal] = useState<number | null>(null);
  const current = categories?.find((c) => c.slug === slug);

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    (categories ?? []).forEach((c) => map.set(c.department, [...(map.get(c.department) ?? []), c]));
    return Array.from(map.entries());
  }, [categories]);

  return (
    <div className="container pt-5">
      <nav className="mb-4 flex items-center gap-1 text-xs text-ink-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <ChevronRight size={12} />
        <span>{current?.department ?? 'Browse'}</span>
        <ChevronRight size={12} />
        <span className="font-semibold text-ink">{current?.name ?? slug}</span>
      </nav>

      <div className="flex gap-6">
        <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto rounded-lg border border-line bg-white md:block">
          {grouped.map(([dept, cats]) => (
            <div key={dept} className="border-b border-line last:border-0">
              <p className="bg-mint/60 px-4 py-2 font-display text-[11px] font-extrabold uppercase tracking-wider text-brand-800">{dept}</p>
              {cats.map((c) => {
                const Icon = categoryIcon(c.slug);
                const active = c.slug === slug;
                return (
                  <Link
                    key={c.id}
                    href={`/browse/${c.slug}`}
                    className={clsx(
                      'flex items-center gap-3 border-l-4 px-3 py-2.5 text-[13px] transition',
                      active ? 'border-brand-500 bg-mint font-bold text-brand-800' : 'border-transparent text-ink-soft hover:bg-mint/50',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: c.themeColor ?? '#EEF6EE' }}>
                      <Icon size={17} strokeWidth={1.6} className="text-brand-700" />
                    </span>
                    <span className="leading-4">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:hidden">
            {(categories ?? []).map((c) => (
              <Link key={c.id} href={`/browse/${c.slug}`} className={clsx('chip shrink-0 border', c.slug === slug ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white')}>
                {c.name}
              </Link>
            ))}
          </div>
          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4"
            style={{ backgroundColor: current?.themeColor ?? '#EEF6EE' }}
          >
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-xl bg-white/70"><ProductImage src={current?.imageUrl} alt={current?.name ?? ''} size="sm" /></span>
              <div>
                <h1 className="font-display text-xl font-bold">{current?.name ?? 'Products'}</h1>
                <p className="text-xs text-ink-soft">{total !== null ? `${total} items` : 'Loading…'} · delivered in minutes</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto py-2 text-xs">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <InfiniteProductGrid category={slug} sort={sort} onTotal={setTotal} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        </div>
      </div>
    </div>
  );
}
