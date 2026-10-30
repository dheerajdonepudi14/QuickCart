'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import clsx from 'clsx';

/** Visualises the 10-minute stock hold created by the backend at checkout. */
export default function ReservationTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const urgent = left < 60_000;
  return (
    <div className={clsx('flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', urgent ? 'bg-red-50 text-danger' : 'bg-mint text-brand-800')}>
      <Lock size={13} />
      Items reserved for you · <span className="font-extrabold tabular-nums">{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
    </div>
  );
}
