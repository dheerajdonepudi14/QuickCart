'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { formatCount } from '@/lib/format';
import { api } from '@/lib/api';

/** Real produce photos pulled from Wikipedia's free REST API (public Wikimedia CDN, works when deployed). */
const ITEMS: { title: string; emoji: string; ring: string; pos: string; size: string; delay: string }[] = [
  { title: 'Strawberry', emoji: '🍓', ring: 'ring-rose-200', pos: 'left-[8%] top-[6%]', size: 'h-24 w-24', delay: '0s' },
  { title: 'Avocado', emoji: '🥑', ring: 'ring-lime-200', pos: 'right-[10%] top-[2%]', size: 'h-28 w-28', delay: '.6s' },
  { title: 'Broccoli', emoji: '🥦', ring: 'ring-emerald-200', pos: 'left-[2%] top-[42%]', size: 'h-28 w-28', delay: '1.2s' },
  { title: 'Banana', emoji: '🍌', ring: 'ring-yellow-200', pos: 'right-[2%] top-[38%]', size: 'h-24 w-24', delay: '.3s' },
  { title: 'Tomato', emoji: '🍅', ring: 'ring-red-200', pos: 'left-[20%] bottom-[6%]', size: 'h-20 w-20', delay: '.9s' },
  { title: 'Orange_(fruit)', emoji: '🍊', ring: 'ring-orange-200', pos: 'right-[18%] bottom-[4%]', size: 'h-24 w-24', delay: '1.5s' },
  { title: 'Carrot', emoji: '🥕', ring: 'ring-orange-100', pos: 'left-[36%] top-[0%]', size: 'h-16 w-16', delay: '2s' },
];

async function fetchThumbs(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    ITEMS.map(async (it) => {
      try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${it.title}`);
        if (!res.ok) return [it.title, ''] as const;
        const data = (await res.json()) as { thumbnail?: { source: string } };
        return [it.title, data.thumbnail?.source ?? ''] as const;
      } catch {
        return [it.title, ''] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export default function GroceryCollage() {
  const { data: thumbs } = useQuery({ queryKey: ['auth-produce'], queryFn: fetchThumbs, staleTime: Infinity, gcTime: Infinity });
  const { data: stats } = useQuery({ queryKey: ['platform-stats'], queryFn: api.stats, staleTime: 30_000 });

  return (
    <div className="relative flex h-full min-h-[600px] flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E8F3E6] via-[#F1F8EF] to-[#FFF6E8] p-10">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#9FD2A9_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative z-10">
        <span className="chip bg-white/80 text-brand-700 shadow-sm">🌿 All natural · farm fresh</span>
        <h2 className="mt-5 font-display text-[40px] leading-[1.08] text-ink">
          <b>Your weekly basket,</b>
          <br />
          delivered in <span className="relative inline-block font-extrabold text-brand-600">10 minutes
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden><path d="M2 9 C 50 2, 150 2, 198 8" stroke="#F5B400" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
          </span>
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-6 text-ink-muted">Veggies, dairy, snacks, brews, beauty and farm supplies from a dark store around the corner.</p>
      </div>

      {/* produce orbit */}
      <div className="relative mx-auto mt-6 aspect-square w-full max-w-[420px] flex-1">
        <div className="absolute inset-[18%] rounded-full bg-white/70 shadow-[0_30px_80px_-20px_rgba(34,160,75,0.35)]" />
        <div className="absolute inset-[26%] rounded-full border-2 border-dashed border-brand-300/70 [animation:spin_40s_linear_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-[40%] w-[40%] flex-col items-center justify-center rounded-full bg-brand-500 text-white shadow-lift">
            <span className="text-5xl drop-shadow">🧺</span>
            <span className="mt-1 font-display text-xs font-extrabold uppercase tracking-wider">QuickCart</span>
          </div>
        </div>
        {ITEMS.map((it) => {
          const src = thumbs?.[it.title];
          return (
            <div key={it.title} className={clsx('absolute animate-float', it.pos)} style={{ animationDelay: it.delay }}>
              <div className={clsx('overflow-hidden rounded-full bg-white shadow-lift ring-4', it.ring, it.size)}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={it.title.replace(/_\(.*\)/, '')} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-4xl">{it.emoji}</span>
                )}
              </div>
            </div>
          );
        })}
        <div className="absolute right-[-2%] top-[64%] animate-float rounded-2xl bg-white px-3 py-2 text-xs shadow-lift" style={{ animationDelay: '.4s' }}>
          <p className="font-bold">⚡ 9 min 42 s</p>
          <p className="text-[10px] text-ink-muted">avg. delivery time</p>
        </div>
        <div className="absolute left-[-2%] top-[22%] animate-float rounded-2xl bg-white px-3 py-2 text-xs shadow-lift" style={{ animationDelay: '1.1s' }}>
          <p className="font-bold text-brand-700">🟢 {stats ? formatCount(stats.activeSessions) : '—'} online</p>
          <p className="text-[10px] text-ink-muted">{stats ? `${formatCount(stats.registeredUsers)} shoppers joined` : 'shopping right now'}</p>
        </div>
      </div>

      {/* road with scooter */}
      <div className="relative z-10 mt-4 h-12 overflow-hidden rounded-xl bg-[#2F3B33]">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 [background:repeating-linear-gradient(90deg,#F5B400_0_18px,transparent_18px_36px)]" />
        <span className="absolute top-1/2 -translate-y-1/2 -scale-x-100 text-3xl [animation:qc-ride_7s_linear_infinite]">🛵</span>
      </div>
      <div className="relative z-10 mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-ink-soft">
        <span className="rounded-lg bg-white/80 py-2">📦 {stats ? formatCount(stats.products) : '190+'} products</span>
        <span className="rounded-lg bg-white/80 py-2">🏬 {stats ? stats.darkStores : 7} dark stores</span>
        <span className="rounded-lg bg-white/80 py-2">🚚 {stats ? formatCount(stats.ordersDelivered) : '—'} delivered</span>
      </div>
    </div>
  );
}
