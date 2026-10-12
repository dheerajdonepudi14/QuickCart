'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCircle2, MapPin, Navigation, Phone, Radio, Satellite, Square } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { Order } from '@/lib/types';
import { formatPrice, STATUS_LABEL, STATUS_TONE, timeAgo } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { TrackingMap } from '@/components/maps';
import { googleMapsDirections } from '@/components/maps/mapConfig';
import Spinner from '@/components/ui/Spinner';

const SEND_EVERY_MS = 5000;

/**
 * Delivery-partner web app: lists assigned deliveries and streams the phone's GPS (watchPosition, throttled to
 * one fix every 5 s) to the backend, which pushes it to the customer's map over WebSockets.
 */
function DeliveryCard({ order, sharing, onShare, onStop, onDelivered, lastSent }: {
  order: Order;
  sharing: boolean;
  onShare: () => void;
  onStop: () => void;
  onDelivered: () => void;
  lastSent: string | null;
}) {
  const home: [number, number] | null = order.deliveryLatitude != null && order.deliveryLongitude != null ? [order.deliveryLatitude, order.deliveryLongitude] : null;
  const store: [number, number] | null = order.storeLatitude != null && order.storeLongitude != null ? [order.storeLatitude, order.storeLongitude] : null;
  const rider: [number, number] | null = order.riderLatitude != null && order.riderLongitude != null ? [order.riderLatitude, order.riderLongitude] : null;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
        <div>
          <p className="font-display text-base font-extrabold">#{order.orderNumber}</p>
          <p className="text-xs text-ink-muted">{order.items.reduce((a, i) => a + i.quantity, 0)} items · {order.paymentMethod === 'CASH_ON_DELIVERY' ? `Collect ${formatPrice(order.totalAmount)} cash` : 'Prepaid'}</p>
        </div>
        <span className={clsx('chip', STATUS_TONE[order.status])}>{STATUS_LABEL[order.status]}</span>
      </div>
      <TrackingMap store={store} home={home} rider={rider} storeName={order.storeName} showRider live={sharing} label={sharing ? 'Sharing GPS' : 'GPS off'} height={260} />
      <div className="space-y-3 p-4 text-sm">
        <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-brand-600" /> <span>{order.deliveryAddress}{order.deliveryLandmark ? ` (near ${order.deliveryLandmark})` : ''}</span></p>
        <p className="flex items-center gap-2"><Phone size={14} className="text-brand-600" /> {order.deliveryContactName ?? order.customerName}
          {(order.deliveryContactPhone ?? order.customerPhone) && <a href={`tel:${order.deliveryContactPhone ?? order.customerPhone}`} className="font-bold text-brand-700">Call</a>}
        </p>
        <div className="flex flex-wrap gap-2">
          {order.status === 'OUT_FOR_DELIVERY' && (
            sharing
              ? <button onClick={onStop} className="btn-outline"><Square size={14} /> Stop sharing</button>
              : <button onClick={onShare} className="btn-primary"><Satellite size={14} /> Share live location</button>
          )}
          {home && rider && <a href={googleMapsDirections(rider, home)} target="_blank" rel="noreferrer" className="btn-soft"><Navigation size={14} /> Navigate</a>}
          {order.status === 'OUT_FOR_DELIVERY' && <button onClick={onDelivered} className="btn-soft"><CheckCircle2 size={14} /> Mark delivered</button>}
        </div>
        {sharing && <p className="text-[11px] text-ink-muted">Last fix sent {lastSent ? timeAgo(lastSent) : '—'} · keep this screen open while riding.</p>}
      </div>
    </div>
  );
}

export default function RiderPage() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const qc = useQueryClient();
  const isRider = user?.role === 'ROLE_DELIVERY_PARTNER';
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSendAt = useRef(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rider-orders'],
    queryFn: api.delivery.myOrders,
    enabled: isRider,
    refetchInterval: 15_000,
  });

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharingId(null);
  }, []);
  useEffect(() => stop, [stop]);

  const share = (orderId: number) => {
    if (!navigator.geolocation) return toast.error('This device has no GPS / geolocation.');
    stop();
    setSharingId(orderId);
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const nowMs = Date.now();
        if (nowMs - lastSendAt.current < SEND_EVERY_MS) return; // throttle to save battery & data
        lastSendAt.current = nowMs;
        try {
          await api.delivery.pushLocation(orderId, pos.coords.latitude, pos.coords.longitude);
          setLastSent(new Date().toISOString());
          void qc.invalidateQueries({ queryKey: ['rider-orders'] });
        } catch (e) {
          toast.error(errorMessage(e));
          stop();
        }
      },
      (err) => {
        toast.error(err.code === err.PERMISSION_DENIED ? 'Allow location access to share your live position.' : 'GPS signal lost — retrying…');
        if (err.code === err.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    toast.success('Sharing live location with the customer');
  };

  const delivered = async (orderId: number) => {
    try {
      await api.delivery.delivered(orderId);
      if (sharingId === orderId) stop();
      toast.success('Marked as delivered 🎉');
      void refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (status === 'unknown') return <div className="container pt-10"><Spinner className="text-brand-500" /></div>;
  if (!isRider) {
    return (
      <div className="container max-w-md pt-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint text-3xl">🛵</div>
        <h1 className="font-display text-xl font-bold">Delivery partner app</h1>
        <p className="mt-2 text-sm text-ink-muted">Sign in with a rider account, e.g. rider1.blr-kor-01@quickcart.dev / Rider@123.</p>
        <Link href="/login?next=/rider" className="btn-primary mt-5">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl pt-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Bike className="text-brand-600" /> My deliveries</h1>
          <p className="text-xs text-ink-muted">{user?.fullName} · {user?.storeName ?? 'QuickCart fleet'}</p>
        </div>
        <span className={clsx('chip', sharingId ? 'bg-mint text-brand-700' : 'bg-zinc-100 text-ink-muted')}>
          <Radio size={12} /> {sharingId ? 'Live' : 'Offline'}
        </span>
      </div>
      {isLoading && <Spinner className="text-brand-500" />}
      {data && data.length === 0 && (
        <div className="card p-10 text-center text-sm text-ink-muted">No deliveries assigned right now. New assignments appear here automatically.</div>
      )}
      <div className="space-y-5">
        {data?.map((o) => (
          <DeliveryCard
            key={o.id}
            order={o}
            sharing={sharingId === o.id}
            onShare={() => share(o.id)}
            onStop={stop}
            onDelivered={() => delivered(o.id)}
            lastSent={sharingId === o.id ? lastSent : null}
          />
        ))}
      </div>
    </div>
  );
}
