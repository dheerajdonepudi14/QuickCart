'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import type { GeoAddress, PlaceSuggestion } from '@/lib/types';

interface Props {
  bias?: { lat: number; lng: number } | null;
  onSelect: (a: GeoAddress) => void;
}

const newSessionToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * Address search: 300 ms debounce, one session token per search (Google bills autocomplete + details as one
 * session), suggestions biased toward the shopper's store. Results come from the backend geo proxy.
 */
export default function AddressAutocomplete({ bias, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const session = useRef(newSessionToken());
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) {
      setItems([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      api.geo
        .autocomplete(text, { lat: bias?.lat, lng: bias?.lng, sessionToken: session.current }, ctrl.signal)
        .then((r) => { setItems(r); setError(null); setActive(-1); setOpen(true); })
        .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setError(errorMessage(e)); })
        .finally(() => setLoading(false));
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, bias?.lat, bias?.lng]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    setQ(s.primaryText);
    try {
      let addr: GeoAddress;
      if (s.latitude != null && s.longitude != null) {
        // OSM suggestion: coordinates included — reverse geocode for structured parts.
        try {
          addr = { ...(await api.geo.reverse(s.latitude, s.longitude)), latitude: s.latitude, longitude: s.longitude, placeId: s.id };
        } catch {
          addr = { latitude: s.latitude, longitude: s.longitude, source: s.source, line2: s.primaryText, formattedAddress: `${s.primaryText}, ${s.secondaryText}`, placeId: s.id };
        }
      } else {
        addr = await api.geo.place(s.id, session.current);
      }
      onSelect(addr);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      session.current = newSessionToken(); // a selection ends the billing session
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); void pick(items[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search your apartment, street or area"
        className="input pl-9 pr-9"
        role="combobox"
        aria-expanded={open}
        aria-controls="address-suggestions"
        aria-autocomplete="list"
        aria-label="Search address"
      />
      {loading ? (
        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-muted" />
      ) : q ? (
        <button type="button" onClick={() => { setQ(''); setItems([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-label="Clear">
          <X size={14} />
        </button>
      ) : null}
      {error && <p className="mt-1 text-[11px] text-amber-700">{error}</p>}
      {open && items.length > 0 && (
        <ul id="address-suggestions" role="listbox" className="absolute left-0 right-0 top-12 z-[1100] max-h-64 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lift">
          {items.map((s, i) => (
            <li key={s.id + i} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => void pick(s)}
                className={clsx('flex w-full items-start gap-2 rounded-md px-2 py-2 text-left', i === active ? 'bg-mint' : 'hover:bg-mint/60')}
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-600" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{s.primaryText}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{s.secondaryText}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-2 pb-1 pt-2 text-right text-[9px] uppercase tracking-wide text-ink-muted">
            {items[0]?.source === 'google' ? 'Powered by Google' : 'Data © OpenStreetMap contributors'}
          </li>
        </ul>
      )}
    </div>
  );
}
