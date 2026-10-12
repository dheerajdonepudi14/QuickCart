'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Navigation } from 'lucide-react';
import { fetchRoute, googleMapsDirections, TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL, type LatLng } from './mapConfig';
import { pillPin, riderPin } from './pins';

export interface TrackingMapProps {
  store: LatLng | null;
  home: LatLng | null;
  rider: LatLng | null;
  storeName: string;
  live: boolean;
  showRider: boolean;
  label?: string;
  height?: number;
}

function FitBounds({ points, version }: { points: LatLng[]; version: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, map]);
  return null;
}

/** Index of the route vertex closest to the rider — splits the line into "done" and "to go". */
function nearestIndex(route: LatLng[], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  route.forEach(([lat, lng], i) => {
    const d = (lat - p[0]) ** 2 + (lng - p[1]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export default function TrackingMap({ store, home, rider, storeName, live, showRider, label, height = 400 }: TrackingMapProps) {
  const [route, setRoute] = useState<LatLng[]>([]);
  const [info, setInfo] = useState<{ km: number; min: number } | null>(null);
  const [fitVersion, setFitVersion] = useState(0);
  const fetched = useRef('');

  const storeKey = store ? store.join(',') : '';
  const homeKey = home ? home.join(',') : '';
  useEffect(() => {
    if (!store || !home) return;
    const key = `${storeKey}|${homeKey}`;
    if (fetched.current === key) return;
    fetched.current = key;
    const ctrl = new AbortController();
    fetchRoute(store, home, ctrl.signal).then((r) => {
      if (!r) return;
      setRoute(r.points);
      setInfo({ km: r.distanceKm, min: r.minutes });
      setFitVersion((v) => v + 1);
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, homeKey]);

  const split = useMemo(() => {
    if (!showRider || !rider || route.length < 2) return { done: [] as LatLng[], todo: route };
    const i = nearestIndex(route, rider);
    return { done: [...route.slice(0, i + 1), rider], todo: [rider, ...route.slice(i + 1)] };
  }, [route, rider, showRider]);

  const fitPoints = useMemo(() => {
    const pts: LatLng[] = [];
    if (store) pts.push(store);
    if (home) pts.push(home);
    return pts.concat(route.length ? [route[Math.floor(route.length / 2)]] : []);
  }, [store, home, route]);

  const icons = useMemo(
    () => ({
      store: pillPin('🏬', storeName, '#E8F3E6'),
      home: pillPin('🏠', 'You', '#FDE7E7'),
      rider: riderPin(),
    }),
    [storeName],
  );

  const center: LatLng = store ?? home ?? [12.9352, 77.6245];
  return (
    <div className="relative overflow-hidden rounded-xl border border-line" style={{ height }}>
      <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full" zoomControl={false} attributionControl>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={TILE_MAX_ZOOM} className="qc-tiles" />
        <FitBounds points={fitPoints} version={fitVersion + (fitPoints.length > 0 ? 1 : 0)} />
        {split.todo.length > 1 && (
          <>
            <Polyline positions={split.todo} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.95 }} />
            <Polyline positions={split.todo} pathOptions={{ color: '#22A04B', weight: 5, opacity: 1 }} />
          </>
        )}
        {split.done.length > 1 && <Polyline positions={split.done} pathOptions={{ color: '#9CA3AF', weight: 5, opacity: 0.8, dashArray: '2 8', lineCap: 'round' }} />}
        {store && (
          <Marker position={store} icon={icons.store}>
            <Tooltip direction="top" offset={[0, -36]}>Dark store · packing your order</Tooltip>
          </Marker>
        )}
        {home && <Marker position={home} icon={icons.home} />}
        {showRider && rider && <Marker position={rider} icon={icons.rider} zIndexOffset={1000} />}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold shadow">
        <span className={live ? 'h-2 w-2 animate-pulse rounded-full bg-danger' : 'h-2 w-2 rounded-full bg-zinc-300'} />
        {live ? 'LIVE' : 'Auto-refresh'}
        {label && <span className="font-semibold text-ink-muted">· {label}</span>}
      </div>
      {info && (
        <div className="absolute bottom-6 left-3 z-[400] rounded-xl bg-white/95 px-3 py-2 text-[11px] shadow">
          <p className="font-bold">{info.km.toFixed(1)} km by road</p>
          <p className="text-ink-muted">≈ {info.min} min drive · via OpenStreetMap</p>
        </div>
      )}
      <div className="absolute right-3 top-3 z-[400] flex flex-col gap-2">
        <button onClick={() => setFitVersion((v) => v + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:text-brand-700" aria-label="Recenter map" title="Recenter">
          <Crosshair size={16} />
        </button>
        {store && home && (
          <a href={googleMapsDirections(store, home)} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow hover:text-brand-700" aria-label="Open in Google Maps" title="Open in Google Maps">
            <Navigation size={16} />
          </a>
        )}
      </div>
    </div>
  );
}
