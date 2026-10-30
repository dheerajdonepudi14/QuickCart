'use client';

import { ChevronDown, MapPin, Timer } from 'lucide-react';
import { useLocationStore } from '@/store/useLocationStore';
import { useUIStore } from '@/store/useUIStore';
import { useHydrated } from '@/lib/hooks';
import { SITE } from '@/lib/site';

export default function TopBar() {
  const hydrated = useHydrated();
  const match = useLocationStore((s) => s.match);
  const setLocationOpen = useUIStore((s) => s.setLocationOpen);

  return (
    <div className="border-b border-line bg-white text-[11px] text-ink-soft">
      <div className="container flex h-9 items-center justify-between gap-4">
        <button onClick={() => setLocationOpen(true)} className="group flex min-w-0 items-center gap-1.5 hover:text-brand-700">
          <MapPin size={13} className="shrink-0 text-brand-500" />
          <span className="shrink-0">Delivery to</span>
          <span className="truncate font-bold text-ink group-hover:text-brand-700">
            {hydrated && match ? match.locationLabel : 'Select your location'}
          </span>
          <ChevronDown size={12} className="shrink-0" />
          {hydrated && match?.serviceable && (
            <span className="ml-2 hidden items-center gap-1 rounded-full bg-mint px-2 py-0.5 font-bold text-brand-700 sm:inline-flex">
              <Timer size={11} /> {match.etaMinutes} mins
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden md:inline">
            Call Us for any query or help: <a href={SITE.phoneHref} className="font-bold text-ink hover:text-brand-700">{SITE.phoneDisplay}</a>
            <span className="mx-2 text-line">|</span>
            <a href={SITE.emailHref} className="font-bold text-ink hover:text-brand-700">{SITE.email}</a>
          </span>
          <span className="flex items-center gap-1">English <ChevronDown size={11} /></span>
          <span className="flex items-center gap-1">INR <ChevronDown size={11} /></span>
        </div>
      </div>
    </div>
  );
}
