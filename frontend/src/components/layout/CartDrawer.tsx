'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShoppingBag, Timer, X } from 'lucide-react';
import { useCartQuote, useHydrated } from '@/lib/hooks';
import { formatPrice } from '@/lib/format';
import { useCartStore } from '@/store/useCartStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import CartLineItem from '../checkout/CartLineItem';
import BillSummary, { FreeDeliveryProgress } from '../checkout/BillSummary';
import Spinner from '../ui/Spinner';

export default function CartDrawer() {
  const hydrated = useHydrated();
  const open = useUIStore((s) => s.cartOpen);
  const close = useUIStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clearCart);
  const user = useAuthStore((s) => s.user);
  const match = useLocationStore((s) => s.match);
  const router = useRouter();
  const quote = useCartQuote();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  if (!open || !hydrated) return null;
  const lines = new Map((quote.data?.lines ?? []).map((l) => [l.productId, l]));
  const blocked = quote.data ? !quote.data.allInStock : false;

  const proceed = () => {
    close();
    router.push(user ? '/checkout' : '/login?next=/checkout');
  };

  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button className="absolute inset-0 animate-fade-in bg-black/30" onClick={close} aria-label="Close cart" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[420px] animate-slide-in flex-col bg-[#F7F9F7] shadow-lift">
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-extrabold">My Cart</h3>
            {match && (
              <p className="flex items-center gap-1 text-[11px] text-ink-muted">
                <Timer size={11} className="text-brand-500" /> Delivery in {quote.data?.etaMinutes ?? match.etaMinutes} mins from {match.store.name}
              </p>
            )}
          </div>
          <button onClick={close} className="icon-btn border-0 bg-mint" aria-label="Close cart">
            <X size={16} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-mint text-5xl">🧺</div>
            <p className="font-display text-lg font-bold">Your cart is empty</p>
            <p className="mt-1 text-sm text-ink-muted">Fresh veggies, snacks, brews and more are just a tap away.</p>
            <button onClick={close} className="btn-primary mt-5">Start shopping</button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {quote.data && <FreeDeliveryProgress quote={quote.data} />}
              <div className="rounded-xl bg-white px-4">
                <div className="flex items-center justify-between border-b border-line py-3">
                  <span className="text-xs font-bold text-ink-soft">{items.length} product{items.length > 1 ? 's' : ''}</span>
                  <button onClick={clear} className="text-[11px] font-bold text-danger hover:underline">Clear cart</button>
                </div>
                <div className="divide-y divide-line">
                  {items.map((i) => <CartLineItem key={i.id} item={i} line={lines.get(i.id)} compact />)}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4">
                {quote.data ? <BillSummary quote={quote.data} /> : (
                  <div className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Calculating your bill…</div>
                )}
                {quote.isError && <p className="mt-2 text-xs text-danger">Couldn&apos;t refresh prices. Check your connection.</p>}
              </div>
              <Link href="/cart" onClick={close} className="block text-center text-xs font-bold text-brand-700 hover:underline">
                View full cart & apply coupons
              </Link>
            </div>
            <div className="border-t border-line bg-white p-4">
              <button
                onClick={proceed}
                disabled={blocked || !quote.data}
                className="flex w-full items-center justify-between rounded-lg bg-brand-500 px-4 py-3 text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                <span className="text-left leading-tight">
                  <span className="block text-base font-extrabold">{formatPrice(quote.data?.total ?? 0)}</span>
                  <span className="text-[10px] font-bold uppercase opacity-80">Total</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-bold">
                  {blocked ? 'Fix stock issues' : user ? 'Proceed to checkout' : 'Login to proceed'} <ArrowRight size={16} />
                </span>
              </button>
              <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-ink-muted">
                <ShoppingBag size={11} /> Stock is reserved for 10 minutes once you check out
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
