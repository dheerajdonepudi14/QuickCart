'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bike, Clock, MapPin, Phone, ReceiptText, Store, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { Order, TrackingUpdate } from '@/lib/types';
import { formatDateTime, formatPrice, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { queryKeys } from '@/lib/hooks';
import { useStompStatus, useStompSubscription } from '@/lib/useStomp';
import { useAuthStore } from '@/store/useAuthStore';
import StatusStepper from '@/components/tracking/StatusStepper';
import { TrackingMap } from '@/components/maps';
import ProductImage from '@/components/product/ProductImage';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import { SITE } from '@/lib/site';

interface Pt { lat: number; lng: number }

const HEADLINE: Partial<Record<Order['status'], string>> = {
  CREATED: 'Waiting for your payment…',
  ORDER_PLACED: 'Order confirmed! The store is on it.',
  PACKING_IN_PROGRESS: 'Your items are being packed',
  OUT_FOR_DELIVERY: 'Your rider is on the way',
  DELIVERED: 'Delivered. Enjoy! 🎉',
  CANCELLED: 'This order was cancelled',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Reservation expired',
};

function Tracker({ orderId }: { orderId: number }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const authStatus = useAuthStore((s) => s.status);
  const live = useStompStatus();
  const [tracking, setTracking] = useState<TrackingUpdate | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const verified = useRef(false);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: () => api.orders.get(orderId),
    enabled: authStatus === 'authenticated',
    refetchInterval: (q) => (q.state.data && ['DELIVERED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED'].includes(q.state.data.status) ? false : 30_000),
  });

  // Returning from a gateway redirect (Stripe 3-D Secure, PhonePe hosted checkout): ask the backend to
  // reconcile with the gateway, and keep polling briefly while the payment settles.
  const returnedFrom = params.get('payment');
  const [payMessage, setPayMessage] = useState<string | null>(null);
  useEffect(() => {
    if (verified.current || !returnedFrom || authStatus !== 'authenticated') return;
    verified.current = true;
    let tries = 0;
    let stop = false;
    const check = async () => {
      tries += 1;
      try {
        const st = await api.payments.status(orderId);
        if (stop) return;
        setPayMessage(st.message ?? null);
        if (st.orderStatus !== 'CREATED' || tries >= 20) {
          stop = true;
          void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
          if (st.orderStatus === 'ORDER_PLACED') toast.success('Payment received 🎉');
          return;
        }
      } catch { /* retry */ }
      if (!stop) setTimeout(check, 3000);
    };
    void check();
    return () => { stop = true; };
  }, [returnedFrom, orderId, qc, authStatus]);

  // Polling fallback when the WebSocket is down (no faster than every 10 s).
  useEffect(() => {
    if (live || authStatus !== 'authenticated') return;
    const poll = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      api.orders.tracking(orderId).then((tr) => setTracking(tr)).catch(() => undefined);
    };
    poll(); // don't leave the ETA blank for the first 10 s
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  }, [live, authStatus, orderId, qc]);

  // Freshness: warn when the rider's location hasn't updated for a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);


  const enabled = authStatus === 'authenticated' ? orderId : null;
  useStompSubscription<Order>(enabled ? `/topic/orders/${orderId}` : null, (o) => {
    const prev = qc.getQueryData<Order>(queryKeys.order(orderId));
    qc.setQueryData(queryKeys.order(orderId), o);
    if (prev && prev.status !== o.status) toast.success(STATUS_LABEL[o.status]);
    void qc.invalidateQueries({ queryKey: queryKeys.orders });
  });
  useStompSubscription<TrackingUpdate>(enabled ? `/topic/orders/${orderId}/tracking` : null, (t) => {
    setTracking(t);
    const prev = qc.getQueryData<Order>(queryKeys.order(orderId));
    if (prev && t.status && prev.status !== t.status) void qc.invalidateQueries({ queryKey: queryKeys.order(orderId) });
  });

  const cancel = async () => {
    if (!order) return;
    if (!window.confirm('Cancel this order? Reserved stock goes back to the store and any payment is refunded.')) return;
    setCancelling(true);
    try {
      const o = await api.orders.cancel(order.id, 'Cancelled by customer');
      qc.setQueryData(queryKeys.order(orderId), o);
      toast.success('Order cancelled');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  if (authStatus === 'guest') {
    return <EmptyState emoji="🔒" title="Sign in to track your order" action={<Link href={`/login?next=/orders/${orderId}/track`} className="btn-primary">Sign in</Link>} />;
  }
  if (isError) return <EmptyState emoji="📦" title="Order not found" text={(error as Error).message} action={<Link href="/orders" className="btn-primary">My orders</Link>} />;
  if (isLoading || !order) return <div className="flex items-center gap-2 py-10 text-ink-muted"><Spinner /> Loading order…</div>;

  const store = order.storeLatitude != null && order.storeLongitude != null ? { lat: order.storeLatitude, lng: order.storeLongitude } : null;
  const home = order.deliveryLatitude != null && order.deliveryLongitude != null ? { lat: order.deliveryLatitude, lng: order.deliveryLongitude } : null;
  const riderPt =
    tracking?.riderLatitude != null && tracking.riderLongitude != null
      ? { lat: tracking.riderLatitude, lng: tracking.riderLongitude }
      : order.riderLatitude != null && order.riderLongitude != null
        ? { lat: order.riderLatitude, lng: order.riderLongitude }
        : null;
  const showRider = order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED';
  const terminalBad = ['CANCELLED', 'PAYMENT_FAILED', 'EXPIRED'].includes(order.status);
  const eta = tracking?.etaMinutes;
  const agent = tracking?.agentName ?? order.deliveryAgentName;
  const lastFixIso = tracking?.locationAt ?? order.riderLocationAt;
  const staleSeconds = lastFixIso ? Math.round((now - new Date(lastFixIso).getTime()) / 1000) : null;
  const stale = order.status === 'OUT_FOR_DELIVERY' && staleSeconds !== null && staleSeconds > 60;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/orders" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-brand-700"><ArrowLeft size={13} /> My orders</Link>
          <h1 className="font-display text-2xl font-bold">{HEADLINE[order.status] ?? STATUS_LABEL[order.status]}</h1>
          <p className="text-xs text-ink-muted">Order #{order.orderNumber} · placed {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={clsx('chip px-3 py-1.5 text-xs', STATUS_TONE[order.status])}>{STATUS_LABEL[order.status]}</span>
      </div>

      {order.status === 'CREATED' && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Spinner className="text-amber-600" />
          <div>
            <p className="font-bold">Waiting for payment confirmation</p>
            <p className="text-xs">{payMessage ?? 'If you completed the payment, this updates automatically within a few seconds.'}</p>
          </div>
        </div>
      )}
      {order.refundStatus && (
        <div className="mb-5 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-sky-800">
          Refund {order.refundStatus === 'REFUNDED' ? 'issued — it reaches your account in 3–5 working days (UPI: 1–3 days).'
            : order.refundStatus === 'PENDING' ? 'initiated — the gateway is processing it.'
            : 'needs attention — our team has been notified and will contact you.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {!terminalBad && (
            <div className="card p-6">
              <StatusStepper status={order.status} timeline={order.timeline} />
            </div>
          )}
          {terminalBad && (
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-danger">
              <XCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">{STATUS_LABEL[order.status]}</p>
                <p className="text-xs">{order.cancelReason ?? 'Reserved stock was released back to the dark store. Any online payment will be refunded in 3–5 days.'}</p>
              </div>
            </div>
          )}

          <TrackingMap
            store={store ? [store.lat, store.lng] : null}
            home={home ? [home.lat, home.lng] : null}
            rider={riderPt ? [riderPt.lat, riderPt.lng] : null}
            storeName={order.storeName}
            showRider={showRider}
            live={live}
            label={
              order.status === 'OUT_FOR_DELIVERY'
                ? `${tracking?.distanceRemainingKm != null ? tracking.distanceRemainingKm.toFixed(2) + ' km away' : 'Rider en route'}`
                : order.status === 'PACKING_IN_PROGRESS' ? 'Packing at store' : order.status === 'DELIVERED' ? 'Delivered' : undefined
            }
          />

          {stale && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              📡 Your rider&apos;s location hasn&apos;t updated for {Math.floor((staleSeconds ?? 0) / 60)} min — they may be in a low-network area.
              The map will catch up as soon as their phone reconnects.
            </div>
          )}
          {!live && order.status === 'OUT_FOR_DELIVERY' && (
            <p className="text-center text-[11px] text-ink-muted">Live connection lost — refreshing every 10 seconds.</p>
          )}
          {order.status === 'OUT_FOR_DELIVERY' && (
            <div className="card flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-2xl">🧑‍✈️</span>
              <div className="flex-1">
                <p className="text-sm font-bold">{agent ?? 'Your delivery partner'}</p>
                <p className="flex items-center gap-1 text-xs text-ink-muted"><Bike size={12} /> Arriving in {eta ?? '—'} min{eta === 1 ? '' : 's'}</p>
              </div>
              {/* Rider numbers stay private; the store support line connects you to the rider. */}
              <a href={SITE.phoneHref} className="btn-soft"><Phone size={14} /> Call support</a>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-5 text-sm">
            <p className="flex items-start gap-2"><Store size={15} className="mt-0.5 text-brand-600" /> <span><b>{order.storeName}</b><br /><span className="text-xs text-ink-muted">Fulfilling dark store</span></span></p>
            <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-brand-600" /> <span className="text-xs leading-5 text-ink-soft">{order.deliveryAddress}</span></p>
            {order.deliveredAt && <p className="flex items-center gap-2 text-xs"><Clock size={14} className="text-brand-600" /> Delivered at {formatDateTime(order.deliveredAt)}</p>}
          </div>
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold"><ReceiptText size={15} /> {order.items.length} items</h3>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {order.items.map((i) => (
                <div key={i.productId} className="flex items-center gap-3">
                  <span className="h-11 w-11 shrink-0 rounded-md bg-mint"><ProductImage src={i.imageUrl} alt={i.title} size="xs" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{i.title}</span>
                    <span className="text-[11px] text-ink-muted">{i.unitQuantity} × {i.quantity}</span>
                  </span>
                  <span className="text-xs font-bold">{formatPrice(i.totalPrice)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-dashed border-line pt-3 text-xs">
              <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              {Number(order.discountAmount) > 0 && <div className="flex justify-between text-brand-700"><span>Coupon {order.couponCode}</span><span>− {formatPrice(order.discountAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-ink-muted">Delivery</span><span>{Number(order.deliveryFee) === 0 ? 'FREE' : formatPrice(order.deliveryFee)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Handling</span><span>{formatPrice(order.handlingFee)}</span></div>
              <div className="flex justify-between pt-1 text-sm font-extrabold"><span>Total ({order.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Paid online'})</span><span>{formatPrice(order.totalAmount)}</span></div>
            </div>
          </div>
          {(order.status === 'CREATED' || order.status === 'ORDER_PLACED') && (
            <button onClick={cancel} disabled={cancelling} className="btn-outline w-full text-danger hover:border-danger hover:text-danger">
              {cancelling ? <Spinner /> : <XCircle size={15} />} Cancel order
            </button>
          )}
          <div className="card p-5">
            <h3 className="mb-3 font-display text-sm font-bold">Timeline</h3>
            <ol className="space-y-3 border-l-2 border-mint pl-4">
              {order.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="text-xs font-bold">{STATUS_LABEL[t.status]}</p>
                  <p className="text-[11px] text-ink-muted">{formatDateTime(t.at)}{t.note ? ` · ${t.note}` : ''}</p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function TrackPage({ params }: { params: { id: string } }) {
  return (
    <div className="container pt-6">
      <Suspense fallback={<Spinner />}>
        <Tracker orderId={Number(params.id)} />
      </Suspense>
    </div>
  );
}
