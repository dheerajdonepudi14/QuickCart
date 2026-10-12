'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEvent, Marker as LMarker } from 'leaflet';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { GeoAddress } from '@/lib/types';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL, type LatLng } from './mapConfig';
import { pillPin } from './pins';

interface Props {
  /** Pin position controlled by the parent (e.g. after picking an autocomplete suggestion). */
  position: LatLng;
  onMove: (p: LatLng, address: GeoAddress | null) => void;
}

function ClickToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function FollowPosition({ position }: { position: LatLng }) {
  const map = useMap();
  const key = position.join(',');
  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 16), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Drag-the-pin / tap-the-map fine tuning. Every move is reverse-geocoded by the backend. */
export default function AddressMapPicker({ position, onMove }: Props) {
  const [busy, setBusy] = useState<'reverse' | 'gps' | null>(null);
  const [label, setLabel] = useState('Drag the pin or tap the map to mark your exact door');
  const ctrl = useRef<AbortController | null>(null);
  const icon = useMemo(() => pillPin('📍', 'Deliver here', '#FDE7E7'), []);

  const resolve = async (p: LatLng) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy('reverse');
    try {
      const r = await api.geo.reverse(p[0], p[1], c.signal);
      setLabel(r.formattedAddress ?? `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`);
      onMove(p, { ...r, latitude: p[0], longitude: p[1] });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setLabel(`Pinned at ${p[0].toFixed(5)}, ${p[1].toFixed(5)}`);
      onMove(p, null);
    } finally {
      if (ctrl.current === c) setBusy(null);
    }
  };

  const gps = () => {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by this browser');
    setBusy('gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => void resolve([pos.coords.latitude, pos.coords.longitude]),
      () => { setBusy(null); toast.error('Could not get your location — search or drag the pin instead.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="relative h-56 overflow-hidden rounded-lg border border-line">
        <MapContainer center={position} zoom={16} scrollWheelZoom className="h-full w-full">
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} className="qc-tiles" />
          <ClickToMove onMove={(p) => void resolve(p)} />
          <FollowPosition position={position} />
          <Marker
            position={position}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (e: LeafletEvent) => {
                const ll = (e.target as LMarker).getLatLng();
                void resolve([ll.lat, ll.lng]);
              },
            }}
          />
        </MapContainer>
        <button
          type="button"
          onClick={gps}
          className="absolute right-2 top-2 z-[400] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold shadow hover:text-brand-700"
        >
          {busy === 'gps' ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />} Use my location
        </button>
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-ink-muted">
        {busy === 'reverse' ? <Loader2 size={12} className="mt-0.5 animate-spin" /> : <MapPin size={12} className="mt-0.5 text-brand-600" />}
        <span className="line-clamp-2">{label}</span>
      </p>
    </div>
  );
}
