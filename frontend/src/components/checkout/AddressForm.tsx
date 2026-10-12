'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Home, Briefcase, MapPin, Navigation } from 'lucide-react';
import type { Address, GeoAddress } from '@/lib/types';
import { api, errorMessage, HttpError } from '@/lib/api';
import { useLocationStore } from '@/store/useLocationStore';
import { useAuthStore } from '@/store/useAuthStore';
import Spinner from '../ui/Spinner';
import { AddressMapPicker } from '../maps';
import type { LatLng } from '../maps/mapConfig';
import AddressAutocomplete from './AddressAutocomplete';

const schema = z.object({
  label: z.enum(['Home', 'Work', 'Other']),
  contactName: z.string().trim().min(2, 'Who should the rider ask for?').max(100),
  contactPhone: z.string().trim().regex(/^[+]?[0-9]{10,14}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(2, 'Flat / house number and building').max(200),
  line2: z.string().trim().max(200).optional(),
  locality: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().max(80).optional(),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a 6-digit pincode'),
  makeDefault: z.boolean(),
});
type Values = z.infer<typeof schema>;

const LABELS = [
  { id: 'Home', icon: Home },
  { id: 'Work', icon: Briefcase },
  { id: 'Other', icon: MapPin },
] as const;

/**
 * Structured address capture: search (autocomplete) → fine-tune the pin → door number, landmark and contact.
 * Coordinates come from the pin; if none, the backend geocodes the typed address and rejects unlocatable ones.
 */
export default function AddressForm({ onSaved, onCancel }: { onSaved: (a: Address) => void; onCancel?: () => void }) {
  const match = useLocationStore((s) => s.match);
  const gpsLat = useLocationStore((s) => s.latitude);
  const gpsLng = useLocationStore((s) => s.longitude);
  const user = useAuthStore((s) => s.user);
  const fallback: LatLng = [gpsLat ?? match?.store.latitude ?? 12.9352, gpsLng ?? match?.store.longitude ?? 77.6245];
  const [pin, setPin] = useState<LatLng>(fallback);
  const [pinned, setPinned] = useState<{ source: string; placeId?: string | null } | null>(
    gpsLat !== null && gpsLng !== null ? { source: 'gps' } : null,
  );
  const [formatted, setFormatted] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: 'Home',
      contactName: user?.fullName ?? '',
      contactPhone: user?.phoneNumber ?? '',
      line1: '',
      line2: '',
      locality: '',
      landmark: '',
      city: match?.store.city ?? '',
      state: '',
      pincode: match?.store.pincode ?? '',
      makeDefault: true,
    },
  });
  const label = watch('label');
  const v = watch();
  const err = formState.errors;

  const fill = (g: GeoAddress, overwriteDoor: boolean) => {
    const opts = { shouldValidate: true } as const;
    if (g.line1 && (overwriteDoor || !v.line1)) setValue('line1', g.line1, opts);
    if (g.line2) setValue('line2', g.line2, opts);
    if (g.locality) setValue('locality', g.locality, opts);
    if (g.city) setValue('city', g.city, opts);
    if (g.state) setValue('state', g.state, opts);
    if (g.pincode && /^[1-9]\d{5}$/.test(g.pincode)) setValue('pincode', g.pincode, opts);
    setFormatted(g.formattedAddress ?? null);
  };

  const onSuggestion = (g: GeoAddress) => {
    setPin([g.latitude, g.longitude]);
    setPinned({ source: g.source, placeId: g.placeId });
    fill(g, false);
  };

  const onPinMove = (p: LatLng, g: GeoAddress | null) => {
    setPin(p);
    setPinned({ source: 'pin' });
    if (g) fill(g, false);
  };

  const onSubmit = async (val: Values) => {
    try {
      const saved = await api.addresses.create({
        ...val,
        line2: val.line2 || undefined,
        locality: val.locality || undefined,
        landmark: val.landmark || undefined,
        state: val.state || undefined,
        latitude: pinned ? pin[0] : null,
        longitude: pinned ? pin[1] : null,
        placeId: pinned?.placeId ?? null,
        geocodeSource: pinned?.source ?? null,
      });
      if (saved.warning) toast.warning(saved.warning, { duration: 6000 });
      else toast.success('Address saved');
      onSaved(saved);
    } catch (e) {
      if (e instanceof HttpError && e.status === 422) toast.error(e.message, { duration: 6000 });
      else toast.error(errorMessage(e));
    }
  };

  const preview = [v.line1, v.line2, v.locality, v.city, v.state].filter(Boolean).join(', ') + (v.pincode ? ` - ${v.pincode}` : '');
  const field = (name: keyof Values, labelText: string, placeholder = '', extra = '') => (
    <div className={extra}>
      <label className="label" htmlFor={`addr-${name}`}>{labelText}</label>
      <input id={`addr-${name}`} {...register(name)} className="input" placeholder={placeholder} />
      {err[name] && <p className="mt-1 text-xs text-danger">{err[name]?.message as string}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-lg border border-line bg-[#FBFDFB] p-4" noValidate>
      <AddressAutocomplete bias={match ? { lat: match.store.latitude, lng: match.store.longitude } : null} onSelect={onSuggestion} />
      <AddressMapPicker position={pin} onMove={onPinMove} />

      <div className="grid gap-3 sm:grid-cols-2">
        {field('line1', 'Flat / House no., Building *', 'e.g. 12B, Sobha Lotus', 'sm:col-span-2')}
        {field('line2', 'Street / Area', 'e.g. Sarjapur Road')}
        {field('locality', 'Locality', 'e.g. Bellandur')}
        {field('landmark', 'Landmark (helps the rider)', 'e.g. Opposite the big park', 'sm:col-span-2')}
        {field('city', 'City *')}
        {field('state', 'State', 'e.g. Karnataka')}
        <div>
          <label className="label" htmlFor="addr-pincode">Pincode *</label>
          <input id="addr-pincode" {...register('pincode')} inputMode="numeric" maxLength={6} className="input" />
          {err.pincode && <p className="mt-1 text-xs text-danger">{err.pincode.message}</p>}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg bg-white p-3 sm:grid-cols-2">
        {field('contactName', 'Receiver’s name *')}
        <div>
          <label className="label" htmlFor="addr-contactPhone">Receiver’s phone *</label>
          <input id="addr-contactPhone" {...register('contactPhone')} inputMode="tel" className="input" placeholder="+91 98xxxxxx" />
          {err.contactPhone && <p className="mt-1 text-xs text-danger">{err.contactPhone.message}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {LABELS.map(({ id, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setValue('label', id)} className={clsx('chip border px-3 py-1.5', label === id ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white')}>
              <Icon size={12} /> {id}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" {...register('makeDefault')} className="accent-brand-500" /> Make default
        </label>
      </div>

      {preview.trim().length > 5 && (
        <div className="rounded-lg border border-brand-200 bg-mint/70 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-bold text-brand-800"><Navigation size={12} /> Deliver to</p>
          <p className="mt-1 text-ink-soft">{preview}{v.landmark ? ` (near ${v.landmark})` : ''}</p>
          {formatted && <p className="mt-1 text-[10px] text-ink-muted">Map: {formatted}</p>}
          {!pinned && <p className="mt-1 text-[10px] font-semibold text-amber-700">No pin yet — we’ll locate this address automatically when you save.</p>}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={formState.isSubmitting} className="btn-primary">{formState.isSubmitting ? <Spinner /> : 'Save address'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>}
      </div>
    </form>
  );
}
