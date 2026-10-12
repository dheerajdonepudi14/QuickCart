'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, LogIn, Package, PackageCheck, ShoppingBasket, UserPlus, Users, Warehouse } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';

export function usePlatformStats(refetchMs = 20_000) {
  return useQuery({ queryKey: ['platform-stats'], queryFn: api.stats, refetchInterval: refetchMs, staleTime: 10_000 });
}

/** Headline platform numbers: users, logins and stock movement across every dark store. */
export default function PlatformKpis() {
  const { data } = usePlatformStats();
  const items = [
    { icon: Users, label: 'Registered users', value: data?.registeredUsers, tone: 'bg-sky-50 text-sky-700' },
    { icon: Activity, label: 'Logged in now', value: data?.activeSessions, tone: 'bg-mint text-brand-700', live: true },
    { icon: LogIn, label: 'Logins today', value: data?.loginsToday, tone: 'bg-violet-50 text-violet-700' },
    { icon: UserPlus, label: 'New today', value: data?.newUsersToday, tone: 'bg-amber-50 text-amber-700' },
    { icon: Package, label: 'Products', value: data?.products, tone: 'bg-mint text-brand-700' },
    { icon: ShoppingBasket, label: 'Units sold', value: data?.unitsSold, tone: 'bg-orange-50 text-orange-700' },
    { icon: Warehouse, label: 'Units left', value: data?.unitsInStock, tone: 'bg-sky-50 text-sky-700' },
    { icon: PackageCheck, label: 'Orders delivered', value: data?.ordersDelivered, tone: 'bg-mint text-brand-700' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map(({ icon: Icon, label, value, tone, live }) => (
        <div key={label} className="card flex items-center gap-3 p-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-ink-muted">
              {label} {live && <span className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 align-middle" />}
            </p>
            <p className="font-display text-lg font-extrabold">{value === undefined ? '—' : formatCount(value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
