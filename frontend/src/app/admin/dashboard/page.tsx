'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Bell, Boxes, Images, LayoutDashboard, Radio, Store, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { AnalyticsRange, LowStockAlert, Order } from '@/lib/types';
import { ACTIVE_STATUSES, STATUS_LABEL, timeAgo } from '@/lib/format';
import { useStompStatus, useStompSubscription } from '@/lib/useStomp';
import { isAdmin, useAuthStore } from '@/store/useAuthStore';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import ControlTower from '@/components/admin/ControlTower';
import InventoryGrid from '@/components/admin/InventoryGrid';
import ImageManager from '@/components/admin/ImageManager';
import UsersPanel from '@/components/admin/UsersPanel';
import PlatformKpis from '@/components/admin/PlatformKpis';
import Spinner from '@/components/ui/Spinner';

type Tab = 'tower' | 'inventory' | 'analytics' | 'users' | 'images';
interface AlertItem extends LowStockAlert { at: string }

const TABS: { id: Tab; label: string; icon: typeof Radio }[] = [
  { id: 'tower', label: 'Control tower', icon: Radio },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'images', label: 'Product images', icon: Images },
];
const PLATFORM_ONLY: Tab[] = ['users', 'images'];

export default function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const live = useStompStatus();
  const [tab, setTab] = useState<Tab>('tower');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [range, setRange] = useState<AnalyticsRange>('daily');
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tick, setTick] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const admin = isAdmin(user);

  const stores = useQuery({ queryKey: ['admin-stores'], queryFn: api.admin.stores, enabled: admin });
  useEffect(() => {
    if (storeId === null && stores.data?.length) setStoreId(user?.storeId ?? stores.data[0].id);
  }, [stores.data, storeId, user]);

  const liveOrders = useQuery({
    queryKey: ['admin-live', storeId],
    queryFn: () => api.admin.orders(storeId as number, 'live'),
    enabled: admin && storeId !== null,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (liveOrders.data) setOrders(liveOrders.data);
  }, [liveOrders.data]);
  useEffect(() => { setAlerts([]); }, [storeId]);

  const upsert = useCallback((o: Order) => {
    setOrders((prev) => {
      const rest = prev.filter((x) => x.id !== o.id);
      return ACTIVE_STATUSES.includes(o.status) ? [o, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : rest;
    });
  }, []);

  useStompSubscription<Order>(admin && storeId ? `/topic/stores/${storeId}/orders` : null, (o) => {
    setOrders((prev) => {
      const isNew = !prev.some((x) => x.id === o.id);
      if (isNew && o.status === 'ORDER_PLACED') {
        toast.success(`🛎️ New order #${o.orderNumber} · ${o.items.length} items`);
        try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => undefined); } catch { /* no audio */ }
      } else if (!isNew) {
        const before = prev.find((x) => x.id === o.id);
        if (before && before.status !== o.status) toast(`#${o.orderNumber} → ${STATUS_LABEL[o.status]}`, { duration: 1500 });
      }
      return prev;
    });
    upsert(o);
    setTick((t) => t + 1);
  });
  useStompSubscription<LowStockAlert>(admin && storeId ? `/topic/stores/${storeId}/alerts` : null, (a) => {
    setAlerts((prev) => [{ ...a, at: new Date().toISOString() }, ...prev].slice(0, 30));
    toast.warning(`Low stock: ${a.title} (${a.stockQuantity} left)`);
  });

  if (status === 'unknown') return <div className="grid min-h-screen place-items-center"><Spinner className="text-brand-500" /></div>;
  if (!admin) {
    return (
      <div className="grid min-h-screen place-items-center bg-mint p-6">
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lift">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint text-3xl">🏬</div>
          <h1 className="font-display text-xl font-bold">Store admins only</h1>
          <p className="mt-2 text-sm text-ink-muted">Sign in with a ROLE_STORE_ADMIN account (e.g. admin@quickcart.dev / Admin@123).</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/login?next=/admin/dashboard" className="btn-primary">Sign in</Link>
            <Link href="/" className="btn-outline">Storefront</Link>
          </div>
        </div>
      </div>
    );
  }

  const current = stores.data?.find((s) => s.id === storeId);
  const counts = {
    new: orders.filter((o) => o.status === 'ORDER_PLACED').length,
    packing: orders.filter((o) => o.status === 'PACKING_IN_PROGRESS').length,
    out: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
  };

  return (
    <div className="min-h-screen bg-[#F7FAF7]">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg text-white">🛒</span>
            <span className="hidden font-display text-lg font-extrabold sm:inline">Quick<span className="text-brand-500">Cart</span> <span className="text-xs font-bold text-ink-muted">OPS</span></span>
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2">
            <Store size={15} className="text-brand-600" />
            <select value={storeId ?? ''} onChange={(e) => setStoreId(Number(e.target.value))} className="bg-transparent py-2 text-sm font-bold outline-none" aria-label="Dark store">
              {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.city}</option>)}
            </select>
          </div>
          <span className={clsx('hidden items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold sm:flex', live ? 'bg-mint text-brand-700' : 'bg-zinc-100 text-ink-muted')}>
            <span className={clsx('h-2 w-2 rounded-full', live ? 'animate-pulse bg-brand-500' : 'bg-zinc-400')} /> {live ? 'LIVE' : 'Offline'}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setAlertsOpen((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint" aria-label="Low stock alerts">
                <Bell size={18} />
                {alerts.length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{alerts.length}</span>}
              </button>
              {alertsOpen && (
                <div className="absolute right-0 top-11 w-80 animate-fade-in rounded-xl border border-line bg-white p-3 shadow-lift">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">Low-stock alerts</p>
                    <button onClick={() => setAlertsOpen(false)} aria-label="Close"><X size={14} /></button>
                  </div>
                  {alerts.length === 0 ? <p className="py-4 text-center text-xs text-ink-muted">All shelves healthy 🌿</p> : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {alerts.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                          <span className="flex-1"><b>{a.title}</b><br />{a.stockQuantity} units left · {timeAgo(a.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {alerts.length > 0 && <button onClick={() => { setTab('inventory'); setAlertsOpen(false); }} className="mt-2 w-full text-center text-xs font-bold text-brand-700 hover:underline">Restock in inventory →</button>}
                </div>
              )}
            </div>
            <span className="hidden text-right text-xs sm:block"><b>{user?.fullName}</b><br /><span className="text-ink-muted">Store admin</span></span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 px-4 lg:px-6">
          {TABS.filter((t) => user?.storeId == null || !PLATFORM_ONLY.includes(t.id)).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={clsx('flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition', tab === t.id ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink')}>
              <t.icon size={15} /> {t.label}
              {t.id === 'tower' && counts.new > 0 && <span className="chip bg-danger py-0.5 text-white">{counts.new}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><LayoutDashboard size={22} className="text-brand-600" /> {current?.name ?? 'Dark store'}</h1>
            <p className="text-xs text-ink-muted">{current ? `${current.storeCode} · ${current.address}, ${current.city} ${current.pincode}` : 'Loading…'}</p>
          </div>
          <div className="flex gap-2 text-center text-xs">
            {[['New', counts.new, 'bg-sky-50 text-sky-700'], ['Packing', counts.packing, 'bg-violet-50 text-violet-700'], ['On road', counts.out, 'bg-orange-50 text-orange-700']].map(([l, n, c]) => (
              <span key={l as string} className={clsx('rounded-xl px-4 py-2', c as string)}><b className="block font-display text-lg">{n}</b>{l}</span>
            ))}
          </div>
        </div>

        {user?.storeId == null && <PlatformKpis />}

        {tab === 'users' && <UsersPanel />}
        {tab === 'images' && <ImageManager />}
        {storeId === null ? <Spinner className="text-brand-500" /> : (
          <>
            {tab === 'tower' && (
              <ControlTower
                storeId={storeId}
                live={orders}
                onChanged={upsert}
                store={current ? { lat: current.latitude, lng: current.longitude, name: current.name } : undefined}
              />
            )}
            {tab === 'inventory' && <InventoryGrid storeId={storeId} refreshKey={alerts.length} />}
            {tab === 'analytics' && <AnalyticsPanel storeId={storeId} range={range} setRange={setRange} liveTick={Math.floor(tick / 3)} />}
          </>
        )}
      </main>
    </div>
  );
}
