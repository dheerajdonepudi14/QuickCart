'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import type { Order, TrackingUpdate } from '@/lib/types';
import { useStompSubscription } from '@/lib/useStomp';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL, type LatLng } from './mapConfig';
import { pillPin, riderPin } from './pins';

function RiderTrack({ order }: { order: Order }) {
  const [pos, setPos] = useState<LatLng | null>(
    order.riderLatitude != null && order.riderLongitude != null ? [order.riderLatitude, order.riderLongitude] : null,
  );
  const [eta, setEta] = useState<number | null>(null);
  useStompSubscription<TrackingUpdate>(`/topic/orders/${order.id}/tracking`, (t) => {
    if (t.riderLatitude != null && t.riderLongitude != null) setPos([t.riderLatitude, t.riderLongitude]);
    if (t.etaMinutes != null) setEta(t.etaMinutes);
  });
  const home: LatLng | null = order.deliveryLatitude != null && order.deliveryLongitude != null ? [order.deliveryLatitude, order.deliveryLongitude] : null;
  const rider = useMemo(() => riderPin(), []);
  const homeIcon = useMemo(() => pillPin('🏠', `#${order.orderNumber.slice(-5)}`, '#FDE7E7'), [order.orderNumber]);
  return (
    <>
      {home && <Marker position={home} icon={homeIcon} />}
      {pos && home && <Polyline positions={[pos, home]} pathOptions={{ color: '#22A04B', weight: 3, dashArray: '4 8', opacity: 0.7 }} />}
      {pos && (
        <Marker position={pos} icon={rider} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0, -24]}>
            {order.deliveryAgentName ?? 'Rider'} · #{order.orderNumber} {eta != null ? `· ${eta} min` : ''}
          </Tooltip>
        </Marker>
      )}
    </>
  );
}

/** Live map of every rider currently on the road for a dark store. */
export default function FleetMap({ store, storeName, orders }: { store: LatLng; storeName: string; orders: Order[] }) {
  const onRoad = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
  const storeIcon = useMemo(() => pillPin('🏬', storeName, '#E8F3E6'), [storeName]);
  const [key, setKey] = useState(store.join(','));
  useEffect(() => setKey(store.join(',')), [store]);
  return (
    <div className="relative h-[340px] overflow-hidden rounded-xl border border-line">
      <MapContainer key={key} center={store} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} className="qc-tiles" />
        <Marker position={store} icon={storeIcon} />
        {onRoad.map((o) => <RiderTrack key={o.id} order={o} />)}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold shadow">
        🛵 {onRoad.length} rider{onRoad.length === 1 ? '' : 's'} on the road
      </div>
    </div>
  );
}
