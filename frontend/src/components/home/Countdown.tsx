'use client';

import { useEffect, useState } from 'react';

/** Ends at the coming midnight (IST-agnostic, uses the shopper's clock) — deals refresh daily. */
function remaining(): number[] {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  let s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const ms = Math.floor((1000 - now.getMilliseconds()) / 10) % 100;
  return [h, m, s, ms];
}

export default function Countdown() {
  const [parts, setParts] = useState<number[] | null>(null);
  useEffect(() => {
    setParts(remaining());
    const t = setInterval(() => setParts(remaining()), 1000);
    return () => clearInterval(t);
  }, []);
  const labels = ['Hours', 'Minutes', 'Seconds', 'Hundredths'];
  return (
    <div className="flex items-center gap-1.5" aria-label="Deal ends in">
      {(parts ?? [0, 0, 0, 0]).slice(0, 3).map((v, i) => (
        <span key={labels[i]} className="flex items-center gap-1.5">
          <span className="flex h-7 min-w-7 items-center justify-center rounded bg-danger px-1 text-[11px] font-bold tabular-nums text-white" title={labels[i]}>
            {String(v).padStart(2, '0')}
          </span>
          {i < 2 && <span className="text-xs font-bold text-danger">:</span>}
        </span>
      ))}
    </div>
  );
}
