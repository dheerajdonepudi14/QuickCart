import { Bike, Check, ClipboardCheck, House, PackageOpen } from 'lucide-react';
import clsx from 'clsx';
import type { OrderStatus, StatusEvent } from '@/lib/types';
import { formatTime } from '@/lib/format';

const STEPS: { status: OrderStatus; label: string; icon: typeof Check }[] = [
  { status: 'ORDER_PLACED', label: 'Order placed', icon: ClipboardCheck },
  { status: 'PACKING_IN_PROGRESS', label: 'Packing', icon: PackageOpen },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: Bike },
  { status: 'DELIVERED', label: 'Delivered', icon: House },
];

export default function StatusStepper({ status, timeline }: { status: OrderStatus; timeline: StatusEvent[] }) {
  const idx = STEPS.findIndex((s) => s.status === status);
  const current = status === 'CREATED' ? -1 : idx;
  const at = (s: OrderStatus) => timeline.find((t) => t.status === s)?.at;

  return (
    <ol className="relative grid grid-cols-4">
      <span className="absolute left-[12.5%] right-[12.5%] top-5 h-1 rounded-full bg-zinc-100" aria-hidden />
      <span
        className="absolute left-[12.5%] top-5 h-1 rounded-full bg-brand-500 transition-all duration-700"
        style={{ width: `${Math.max(0, current) * 25}%` }}
        aria-hidden
      />
      {STEPS.map((s, i) => {
        const done = i < current || status === 'DELIVERED';
        const active = i === current && status !== 'DELIVERED';
        return (
          <li key={s.status} className="relative flex flex-col items-center text-center">
            <span
              className={clsx(
                'relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white transition',
                done ? 'bg-brand-500 text-white' : active ? 'bg-brand-500 text-white shadow-lift' : 'bg-zinc-100 text-ink-muted',
              )}
            >
              {active && <span className="absolute inset-0 animate-ping-slow rounded-full bg-brand-400" />}
              {done ? <Check size={18} /> : <s.icon size={18} className="relative" />}
            </span>
            <span className={clsx('mt-2 text-[11px] font-bold md:text-xs', done || active ? 'text-ink' : 'text-ink-muted')}>{s.label}</span>
            <span className="text-[10px] text-ink-muted">{at(s.status) ? formatTime(at(s.status)) : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
