'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { ACTIVE_STATUSES, formatDateTime, formatPrice, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useStoreId } from '@/store/useLocationStore';
import { useUIStore } from '@/store/useUIStore';
import ProductImage from '@/components/product/ProductImage';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';

export default function OrdersPage() {
  const status = useAuthStore((s) => s.status);
  const storeId = useStoreId();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);

  const q = useInfiniteQuery({
    queryKey: ['orders'],
    queryFn: ({ pageParam }) => api.orders.mine(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length : undefined),
    enabled: status === 'authenticated',
  });

  const reorder = (o: Order) => {
    if (!storeId) return;
    o.items.forEach((i) => {
      for (let n = 0; n < i.quantity; n += 1) {
        addItem({ id: i.productId, title: i.title, price: Number(i.unitPrice), mrp: Number(i.unitPrice), unitQuantity: i.unitQuantity, imageUrl: i.imageUrl, darkStoreId: storeId, maxQuantity: 20 });
      }
    });
    toast.success('Items added — prices refresh from your current store');
    openCart();
  };

  if (status === 'unknown') return <div className="container pt-10"><Spinner className="text-brand-500" /></div>;
  if (status === 'guest') {
    return <div className="container pt-10"><EmptyState emoji="🔒" title="Sign in to see your orders" action={<Link href="/login?next=/orders" className="btn-primary">Sign in</Link>} /></div>;
  }

  const orders = q.data?.pages.flat() ?? [];
  return (
    <div className="container pt-6">
      <h1 className="mb-6 font-display text-2xl font-bold">My Orders</h1>
      {q.isLoading && <Spinner className="text-brand-500" />}
      {!q.isLoading && orders.length === 0 && (
        <EmptyState emoji="📦" title="No orders yet" text="Your first 10-minute delivery is waiting." action={<Link href="/" className="btn-primary">Shop now</Link>} />
      )}
      <div className="space-y-4">
        {orders.map((o) => {
          const active = ACTIVE_STATUSES.includes(o.status);
          return (
            <div key={o.id} className={clsx('card p-5 transition hover:shadow-card', active && 'border-brand-300')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold">#{o.orderNumber}</p>
                  <p className="text-[11px] text-ink-muted">{formatDateTime(o.createdAt)} · {o.storeName}</p>
                </div>
                <span className={clsx('chip', STATUS_TONE[o.status])}>{STATUS_LABEL[o.status]}</span>
              </div>
              <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
                {o.items.map((i) => (
                  <span key={i.productId} className="h-12 w-12 shrink-0 rounded-md bg-mint" title={i.title}><ProductImage src={i.imageUrl} alt={i.title} size="xs" /></span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm font-extrabold">{formatPrice(o.totalAmount)}</span>
                <div className="flex gap-2">
                  <button onClick={() => reorder(o)} className="btn-outline py-2"><RotateCcw size={13} /> Reorder</button>
                  <Link href={`/orders/${o.id}/track`} className={clsx(active ? 'btn-primary' : 'btn-soft', 'py-2')}>
                    {active ? 'Track live' : 'Details'} <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {q.hasNextPage && (
        <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="btn-outline mx-auto mt-6 flex">
          {q.isFetchingNextPage ? <Spinner /> : 'Load more'}
        </button>
      )}
    </div>
  );
}
