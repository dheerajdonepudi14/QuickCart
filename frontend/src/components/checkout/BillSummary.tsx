import { Info, Truck } from 'lucide-react';
import type { Quote } from '@/lib/types';
import { formatPrice } from '@/lib/format';

function Row({ label, value, tone, hint }: { label: string; value: string; tone?: 'green' | 'muted'; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px]">
      <span className="flex items-center gap-1 text-ink-soft">
        {label}
        {hint && (
          <span title={hint} className="text-ink-muted">
            <Info size={12} />
          </span>
        )}
      </span>
      <span className={tone === 'green' ? 'font-bold text-brand-600' : tone === 'muted' ? 'text-ink-muted' : 'font-semibold'}>{value}</span>
    </div>
  );
}

export function FreeDeliveryProgress({ quote }: { quote: Quote }) {
  const threshold = Number(quote.subtotal) + Number(quote.amountForFreeDelivery);
  const pct = threshold > 0 ? Math.min(100, (Number(quote.subtotal) / threshold) * 100) : 100;
  const free = Number(quote.amountForFreeDelivery) <= 0;
  return (
    <div className="rounded-lg bg-mint p-3">
      <p className="flex items-center gap-2 text-xs font-bold text-brand-800">
        <Truck size={14} />
        {free ? 'Yay! You get FREE delivery on this order' : `Add ${formatPrice(quote.amountForFreeDelivery)} more for FREE delivery`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillSummary({ quote }: { quote: Quote }) {
  const saved = Number(quote.productSavings) + Number(quote.couponDiscount);
  return (
    <div>
      <h4 className="mb-2 font-display text-sm font-bold">Bill details</h4>
      <Row label="Items total (MRP)" value={formatPrice(quote.itemsMrp)} tone="muted" />
      <Row label="Product discount" value={`− ${formatPrice(quote.productSavings)}`} tone="green" />
      <Row label="Subtotal" value={formatPrice(quote.subtotal)} />
      {Number(quote.couponDiscount) > 0 && (
        <Row label={`Coupon (${quote.coupon?.code ?? ''})`} value={`− ${formatPrice(quote.couponDiscount)}`} tone="green" />
      )}
      <Row
        label="Delivery fee"
        value={Number(quote.deliveryFee) === 0 ? 'FREE' : formatPrice(quote.deliveryFee)}
        tone={Number(quote.deliveryFee) === 0 ? 'green' : undefined}
        hint="Free above ₹199. A small surcharge applies beyond 5 km from the dark store."
      />
      <Row label="Handling fee" value={formatPrice(quote.handlingFee)} hint="Covers packaging & dark-store operations" />
      <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-3">
        <span className="font-display text-sm font-extrabold">To pay</span>
        <span className="font-display text-lg font-extrabold">{formatPrice(quote.total)}</span>
      </div>
      {saved > 0 && (
        <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-center text-xs font-bold text-brand-700">
          🎉 You&apos;re saving {formatPrice(saved)} on this order
        </p>
      )}
    </div>
  );
}
