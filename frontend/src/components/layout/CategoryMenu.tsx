'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { useCategories } from '@/lib/hooks';
import { categoryIcon } from '@/lib/icons';
import { useUIStore } from '@/store/useUIStore';
import type { Category } from '@/lib/types';

export default function CategoryMenu() {
  const open = useUIStore((s) => s.categoriesOpen);
  const setOpen = useUIStore((s) => s.setCategoriesOpen);
  const { data } = useCategories();
  const ref = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    (data ?? []).forEach((c) => {
      const list = map.get(c.department) ?? [];
      list.push(c);
      map.set(c.department, list);
    });
    return Array.from(map.entries());
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(target) && !target.closest('[aria-expanded]')) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="fixed left-1/2 top-[6.5rem] z-50 w-[min(96vw,1100px)] -translate-x-1/2 animate-fade-in rounded-2xl border border-line bg-white p-6 shadow-lift"
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {grouped.map(([dept, cats]) => (
          <div key={dept}>
            <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-wider text-brand-700">{dept}</p>
            <ul className="space-y-1">
              {cats.map((c) => {
                const Icon = categoryIcon(c.slug);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/browse/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-soft hover:bg-mint hover:text-brand-700"
                    >
                      <Icon size={16} strokeWidth={1.6} className="text-brand-500" />
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-sm text-ink-muted">Loading categories…</p>}
      </div>
    </div>
  );
}
