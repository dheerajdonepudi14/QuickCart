'use client';

import { useState } from 'react';
import { BadgePercent, Check, X } from 'lucide-react';
import clsx from 'clsx';
import type { Quote } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { useCoupons } from '@/lib/hooks';
import { useCartStore } from '@/store/useCartStore';

export default function CouponBox({ quote }: { quote?: Quote }) {
  const couponCode = useCartStore((s) => s.couponCode);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const [input, setInput] = useState('');
  const { data: coupons } = useCoupons();
  const result = quote?.coupon;
  const subtotal = Number(quote?.subtotal ?? 0);

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold"><BadgePercent size={16} className="text-brand-600" /> Coupons & offers</h4>
      {couponCode ? (
        <div className={clsx('flex items-center justify-between rounded-lg border px-3 py-2.5', result?.applied ? 'border-brand-300 bg-mint' : 'border-amber-200 bg-amber-50')}>
          <div>
            <p className="text-sm font-extrabold tracking-wide">{couponCode}</p>
            <p className={clsx('text-[11px]', result?.applied ? 'text-brand-700' : 'text-amber-700')}>
              {result ? (result.applied ? `Applied · you save ${formatPrice(result.discount)}` : result.message) : 'Checking…'}
            </p>
          </div>
          <button onClick={() => setCoupon(null)} className="text-ink-muted hover:text-danger" aria-label="Remove coupon"><X size={16} /></button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) { setCoupon(input); setInput(''); } }}
          className="flex gap-2"
        >
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="input uppercase" aria-label="Coupon code" />
          <button type="submit" className="btn-soft shrink-0">Apply</button>
        </form>
      )}
      {coupons && coupons.length > 0 && (
        <div className="mt-3 space-y-2">
          {coupons.map((c) => {
            const eligible = subtotal >= Number(c.minCartValue);
            const active = couponCode === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setCoupon(c.code)}
                disabled={active}
                className={clsx('flex w-full items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-left transition', active ? 'border-brand-400 bg-mint' : 'border-line hover:border-brand-300')}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold tracking-wide text-brand-700">{c.code}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{c.description}</span>
                  {!eligible && <span className="block text-[10px] font-bold text-amber-700">Add {formatPrice(Number(c.minCartValue) - subtotal)} more to unlock</span>}
                </span>
                {active ? <Check size={15} className="text-brand-600" /> : <span className="text-[11px] font-bold text-brand-600">APPLY</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
