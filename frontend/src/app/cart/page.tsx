'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Timer } from 'lucide-react';
import { useCartQuote, useHydrated } from '@/lib/hooks';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import CartLineItem from '@/components/checkout/CartLineItem';
import BillSummary, { FreeDeliveryProgress } from '@/components/checkout/BillSummary';
import CouponBox from '@/components/checkout/CouponBox';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const user = useAuthStore((s) => s.user);
  const match = useLocationStore((s) => s.match);
  const router = useRouter();
  const quote = useCartQuote();

  if (!hydrated) return <div className="container pt-10"><Spinner className="text-brand-500" /></div>;
  if (items.length === 0) {
    return (
      <div className="container pt-10">
        <EmptyState emoji="🧺" title="Your cart is empty" text="Add fresh produce, snacks, brews, skin care and more." action={<Link href="/" className="btn-primary">Start shopping</Link>} />
      </div>
    );
  }
  const lines = new Map((quote.data?.lines ?? []).map((l) => [l.productId, l]));
  const blocked = quote.data ? !quote.data.allInStock : true;

  return (
    <div className="container pt-6">
      <h1 className="font-display text-2xl font-bold">Shopping Cart</h1>
      {match && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
          <Timer size={12} className="text-brand-500" /> Delivering in ~{quote.data?.etaMinutes ?? match.etaMinutes} mins from {match.store.name}
        </p>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {quote.data && <FreeDeliveryProgress quote={quote.data} />}
          <div className="card divide-y divide-line px-5">
            {items.map((i) => <CartLineItem key={i.id} item={i} line={lines.get(i.id)} />)}
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5"><CouponBox quote={quote.data} /></div>
          <div className="card p-5">
            {quote.data ? <BillSummary quote={quote.data} /> : <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Calculating…</p>}
            <button
              onClick={() => router.push(user ? '/checkout' : '/login?next=/checkout')}
              disabled={blocked}
              className="btn-primary mt-5 w-full py-3.5"
            >
              {user ? 'Proceed to checkout' : 'Login to checkout'} <ArrowRight size={16} />
            </button>
            {quote.data && !quote.data.allInStock && <p className="mt-2 text-center text-xs text-danger">Some items are short on stock — adjust quantities to continue.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
