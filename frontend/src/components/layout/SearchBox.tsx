'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Suggestion } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { useStoreId } from '@/store/useLocationStore';
import ProductImage from '../product/ProductImage';

const PLACEHOLDERS = ['Products, Brands or Category', '"milk"', '"kombucha"', '"face wash"', '"tomato seeds"', '"beard oil"'];

export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const storeId = useStoreId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [ph, setPh] = useState(0);
  const debounced = useDebounced(q.trim(), 180);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === '/search') setQ(params.get('q') ?? '');
  }, [pathname, params]);

  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!storeId || debounced.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api.catalog
      .suggest(storeId, debounced, ctrl.signal)
      .then((r) => { setItems(r); setActive(-1); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced, storeId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[active];
      if (active >= 0 && pick) { setOpen(false); router.push(`/product/${pick.id}`); }
      else go(q);
    }
  };

  const showPanel = open && q.trim().length >= 2;
  return (
    <div ref={wrap} className="relative w-full max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} role="search">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={`Search for ${PLACEHOLDERS[ph]}`}
          className="h-10 w-full rounded-md border border-line bg-white pl-4 pr-16 text-[13px] outline-none transition placeholder:text-ink-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          role="combobox"
          aria-label="Search products"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="search-suggestions"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); setItems([]); }} className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink hover:text-brand-600" aria-label="Search">
          <Search size={17} />
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[420px] animate-fade-in overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-lift" role="listbox" id="search-suggestions">
          {loading && items.length === 0 && <p className="px-3 py-4 text-sm text-ink-muted">Searching…</p>}
          {!loading && items.length === 0 && <p className="px-3 py-4 text-sm text-ink-muted">No quick matches. Press Enter to search everything.</p>}
          {items.map((s, i) => (
            <button
              key={s.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => { setOpen(false); router.push(`/product/${s.id}`); }}
              className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left', i === active ? 'bg-mint' : 'hover:bg-mint/60')}
              role="option"
              aria-selected={i === active}
            >
              <span className="h-10 w-10 shrink-0 rounded-md bg-mint">
                <ProductImage src={s.imageUrl} alt={s.title} size="xs" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.title}</span>
                <span className="block truncate text-[11px] text-ink-muted">{s.brand ? `${s.brand} · ` : ''}{s.categoryName}</span>
              </span>
              <span className="text-sm font-bold text-brand-600">{formatPrice(s.salePrice)}</span>
            </button>
          ))}
          {items.length > 0 && (
            <button onClick={() => go(q)} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-brand-700 hover:bg-mint">
              See all results for “{q.trim()}” →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
