'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, IndianRupee, PackageX, ShoppingBag, Timer, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import type { AnalyticsRange } from '@/lib/types';
import { formatCompact, formatPrice } from '@/lib/format';
import ProductImage from '../product/ProductImage';
import Spinner from '../ui/Spinner';

function Kpi({ icon: Icon, label, value, tone = 'green' }: { icon: typeof TrendingUp; label: string; value: string; tone?: 'green' | 'amber' | 'red' | 'sky' }) {
  const tones = { green: 'bg-mint text-brand-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-danger', sky: 'bg-sky-50 text-sky-700' };
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl', tones[tone])}><Icon size={20} /></span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="font-display text-xl font-extrabold">{value}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPanel({ storeId, range, setRange, liveTick }: { storeId: number; range: AnalyticsRange; setRange: (r: AnalyticsRange) => void; liveTick: number }) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['analytics', storeId, range, liveTick],
    queryFn: () => api.admin.analytics(storeId, range),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const series = (data?.series ?? []).map((p) => ({ ...p, revenue: Number(p.revenue) }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Performance {isFetching && <Spinner className="ml-2 text-brand-500" />}</h2>
        <div className="flex rounded-lg bg-mint p-1">
          {(['daily', 'weekly', 'monthly'] as AnalyticsRange[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={clsx('rounded-md px-4 py-1.5 text-xs font-bold capitalize transition', range === r ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft')}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {isLoading || !data ? (
        <div className="grid h-40 place-items-center"><Spinner className="text-brand-500" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi icon={IndianRupee} label="Revenue" value={formatPrice(data.revenue)} />
            <Kpi icon={ShoppingBag} label="Orders" value={String(data.orders)} tone="sky" />
            <Kpi icon={TrendingUp} label="Avg order value" value={formatPrice(data.averageOrderValue)} />
            <Kpi icon={Timer} label="Active orders" value={String(data.activeOrders)} tone="sky" />
            <Kpi icon={AlertTriangle} label="Low stock SKUs" value={String(data.lowStockCount)} tone="amber" />
            <Kpi icon={PackageX} label="Out of stock" value={String(data.outOfStockCount)} tone="red" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
            <div className="card p-5">
              <p className="mb-4 text-sm font-bold">Revenue ({range})</p>
              <div className="h-72">
                {series.length === 0 ? (
                  <p className="grid h-full place-items-center text-sm text-ink-muted">No paid orders in this window yet — place a few to light up the chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22A04B" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22A04B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#EEF2EE" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#8A8A90' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11, fill: '#8A8A90' }} tickLine={false} axisLine={false} width={60} />
                      <Tooltip formatter={(v: number) => formatPrice(v)} contentStyle={{ borderRadius: 10, border: '1px solid #ECECEC', fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" stroke="#22A04B" strokeWidth={2.5} fill="url(#rev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="card p-5">
              <p className="mb-4 text-sm font-bold">Orders</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid stroke="#EEF2EE" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8A8A90' }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8A8A90' }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #ECECEC', fontSize: 12 }} />
                    <Bar dataKey="orders" fill="#9FD2A9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-4 text-sm font-bold">Top-selling SKUs at this dark store</p>
            {data.topSkus.length === 0 ? (
              <p className="text-sm text-ink-muted">No sales yet.</p>
            ) : (
              <div className="space-y-3">
                {data.topSkus.map((s, i) => {
                  const max = Number(data.topSkus[0]?.units ?? 1);
                  return (
                    <div key={s.productId} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-ink-muted">{i + 1}</span>
                      <span className="h-10 w-10 shrink-0 rounded-md bg-mint"><ProductImage src={s.imageUrl} alt={s.title} size="xs" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{s.title}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-mint"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(s.units) / max) * 100}%` }} /></div>
                      </div>
                      <span className="w-16 text-right text-xs font-bold">{s.units} units</span>
                      <span className="w-24 text-right text-xs font-extrabold text-brand-700">{formatPrice(s.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
