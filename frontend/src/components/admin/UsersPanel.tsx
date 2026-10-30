'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { UserFilter } from '@/lib/types';
import { formatCount, formatDateTime, formatPrice, timeAgo } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import Spinner from '../ui/Spinner';

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: 'All accounts' },
  { id: 'loggedIn', label: 'Logged in' },
  { id: 'customers', label: 'Customers' },
];

const ROLE: Record<string, string> = { ROLE_CUSTOMER: 'Customer', ROLE_STORE_ADMIN: 'Admin', ROLE_DELIVERY_PARTNER: 'Rider' };

export default function UsersPanel() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [page, setPage] = useState(0);
  const debounced = useDebounced(q.trim(), 300);
  useEffect(() => setPage(0), [debounced, filter]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-users', debounced, filter, page],
    queryFn: () => api.insights.users({ q: debounced || undefined, filter, page, size: 25 }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  if (isError) return <div className="card p-6 text-sm text-danger">{(error as Error).message}</div>;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone…" className="input py-2 pl-9 text-xs" />
        </div>
        <div className="flex items-center gap-3">
          {isFetching && <Spinner className="text-brand-500" />}
          <div className="flex rounded-lg bg-mint p-1">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={clsx('rounded-md px-3 py-1.5 text-xs font-bold', filter === f.id ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft')}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-mint/60 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="py-2.5 pl-4">User</th><th>Phone</th><th>Role</th><th>Sign-in</th><th>Joined</th><th>Last login</th>
              <th className="text-right">Logins</th><th className="text-right">Orders</th><th className="pr-4 text-right">Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <tr><td colSpan={9} className="py-10 text-center"><Spinner className="text-brand-500" /></td></tr>}
            {data?.content.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5 pl-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-[11px] font-bold text-brand-800">
                      {u.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white', u.loggedIn ? 'bg-brand-500' : 'bg-zinc-300')} title={u.loggedIn ? 'Logged in' : 'Signed out'} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{u.fullName}</p>
                      <p className="truncate text-[11px] text-ink-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td>{u.phoneNumber ?? '—'}</td>
                <td><span className={clsx('chip', u.role === 'ROLE_CUSTOMER' ? 'bg-sky-50 text-sky-700' : u.role === 'ROLE_STORE_ADMIN' ? 'bg-violet-50 text-violet-700' : 'bg-orange-50 text-orange-700')}>{ROLE[u.role] ?? u.role}</span></td>
                <td className="capitalize">{u.provider.toLowerCase()}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td title={formatDateTime(u.lastLoginAt)}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                <td className="text-right">{formatCount(u.loginCount)}</td>
                <td className="text-right">{formatCount(u.orders)}</td>
                <td className="pr-4 text-right font-bold">{formatPrice(u.totalSpent)}</td>
              </tr>
            ))}
            {data && data.content.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-sm text-ink-muted">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs">
          <span className="text-ink-muted">{formatCount(data.totalElements)} users · page {data.page + 1} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-outline py-1.5">Prev</button>
            <button disabled={data.last} onClick={() => setPage((p) => p + 1)} className="btn-outline py-1.5">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
