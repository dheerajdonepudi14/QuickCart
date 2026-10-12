'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(begin + (value - begin) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{formatCount(shown)}</>;
}

/** Live platform numbers straight from the backend (/api/v1/stats), refreshed every 30 s. */
export default function LiveStats() {
  const { data } = useQuery({ queryKey: ['platform-stats'], queryFn: api.stats, refetchInterval: 30_000, staleTime: 15_000 });
  if (!data) return null;
  const items = [
    { emoji: '👥', label: 'Registered shoppers', value: data.registeredUsers },
    { emoji: '🟢', label: 'Logged in now', value: data.activeSessions },
    { emoji: '🥬', label: 'Products', value: data.products },
    { emoji: '🛍️', label: 'Items sold', value: data.unitsSold },
    { emoji: '📦', label: 'Items left in stock', value: data.unitsInStock },
    { emoji: '🚚', label: 'Orders delivered', value: data.ordersDelivered },
  ];
  return (
    <section className="mt-14 overflow-hidden rounded-lg bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 p-6 text-white md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/80">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live on QuickCart
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Groceries moving right now</h2>
        </div>
        <p className="text-xs text-white/70">{data.darkStores} dark stores · {data.categories} categories</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xl">{i.emoji}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums"><CountUp value={i.value} /></p>
            <p className="text-[11px] font-semibold text-white/80">{i.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
