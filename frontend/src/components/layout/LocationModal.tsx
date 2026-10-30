'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crosshair, MapPin, Store } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { StoreMatch } from '@/lib/types';
import { useLocationStore } from '@/store/useLocationStore';
import { useUIStore } from '@/store/useUIStore';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';

export default function LocationModal() {
  const open = useUIStore((s) => s.locationOpen);
  const setOpen = useUIStore((s) => s.setLocationOpen);
  const match = useLocationStore((s) => s.match);
  const setMatch = useLocationStore((s) => s.setMatch);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<'pin' | 'gps' | null>(null);
  const [preview, setPreview] = useState<StoreMatch | null>(null);
  const stores = useQuery({ queryKey: ['stores'], queryFn: api.stores.list, enabled: open, staleTime: 10 * 60_000 });

  const apply = (m: StoreMatch, coords?: { latitude: number; longitude: number } | null, pincode?: string | null) => {
    if (!m.serviceable) {
      setPreview(m);
      return;
    }
    setMatch(m, coords, pincode, true);
    setPreview(null);
    setOpen(false);
    toast.success(`Delivering from ${m.store.name} in ~${m.etaMinutes} mins`);
  };

  const byPin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }
    setBusy('pin');
    try { apply(await api.stores.byPincode(pin), null, pin); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(null); }
  };

  const byGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }
    setBusy('gps');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        try { apply(await api.stores.nearest(coords.latitude, coords.longitude), coords, null); }
        catch (e) { toast.error(errorMessage(e)); }
        finally { setBusy(null); }
      },
      (err) => {
        setBusy(null);
        toast.error(err.code === err.PERMISSION_DENIED ? 'Location permission denied — enter your pincode instead.' : 'Could not detect your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const pickStore = async (pincode: string) => {
    setBusy('pin');
    try { apply(await api.stores.byPincode(pincode), null, pincode); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Choose your delivery location">
      <p className="-mt-2 mb-5 text-sm text-ink-muted">
        We map you to the nearest dark store so prices and stock are exactly what&apos;s on the shelf near you.
      </p>
      <button onClick={byGps} disabled={busy !== null} className="btn-primary w-full normal-case tracking-normal">
        {busy === 'gps' ? <Spinner /> : <Crosshair size={16} />} Use my current location
      </button>
      <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase text-ink-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && byPin()}
          inputMode="numeric"
          placeholder="Enter 6-digit pincode"
          className="input"
          aria-label="Pincode"
        />
        <button onClick={byPin} disabled={busy !== null} className="btn-soft shrink-0">
          {busy === 'pin' ? <Spinner /> : 'Check'}
        </button>
      </div>

      {preview && !preview.serviceable && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          We don&apos;t deliver there yet. The closest hub is <b>{preview.store.name}</b> ({preview.distanceKm.toFixed(1)} km away).
          <button onClick={() => { setMatch(preview, null, preview.store.pincode, true); setOpen(false); }} className="ml-1 font-bold underline">
            Browse that store anyway
          </button>
        </div>
      )}

      <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-ink-muted">Our dark stores</p>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {(stores.data ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => pickStore(s.pincode)}
            className={clsx(
              'flex items-start gap-2 rounded-lg border p-2.5 text-left transition hover:border-brand-400',
              match?.store.id === s.id ? 'border-brand-400 bg-mint' : 'border-line',
            )}
          >
            <Store size={15} className="mt-0.5 shrink-0 text-brand-500" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{s.name}</span>
              <span className="flex items-center gap-1 truncate text-[11px] text-ink-muted">
                <MapPin size={10} /> {s.city} · {s.pincode}
              </span>
            </span>
          </button>
        ))}
        {stores.isLoading && <p className="text-sm text-ink-muted">Loading stores…</p>}
      </div>
    </Modal>
  );
}
