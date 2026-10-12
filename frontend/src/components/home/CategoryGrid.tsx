'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCategories } from '@/lib/hooks';
import { categoryIcon } from '@/lib/icons';

/** Mockup order first: grains, beauty, cleaning, baby, fruits & veg, dairy, crockery, snacks. */
const FEATURED = ['atta-rice-dal', 'skin-care', 'cleaning-household', 'baby-care', 'fruits-vegetables', 'dairy-bread-eggs', 'home-kitchen', 'snacks-munchies'];

export default function CategoryGrid() {
  const { data, isLoading } = useCategories();
  const [all, setAll] = useState(false);
  const sorted = [...(data ?? [])].sort((a, b) => {
    const ia = FEATURED.indexOf(a.slug);
    const ib = FEATURED.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const shown = all ? sorted : sorted.slice(0, 8);

  return (
    <section className="mt-14">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="section-title">Shop by Category</h2>
        <button onClick={() => setAll((v) => !v)} className="link-underline">{all ? 'Show Less' : 'View All'}</button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        {isLoading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[1.45] animate-pulse rounded-md bg-mint" />)}
        {shown.map((c) => {
          const Icon = categoryIcon(c.slug);
          return (
            <Link
              key={c.id}
              href={`/browse/${c.slug}`}
              className="group flex aspect-[1.45] flex-col items-center justify-center rounded-md bg-mint px-3 text-center transition hover:bg-brand-100 hover:shadow-card"
            >
              <Icon size={34} strokeWidth={1.4} className="text-brand-600 transition group-hover:scale-110" />
              <span className="mt-3 font-display text-[13px] font-semibold leading-4">{c.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
