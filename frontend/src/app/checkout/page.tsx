'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Check, CreditCard, Home, MapPin, Plus, ShieldCheck, Smartphone, Timer, Trash2, Wallet, Zap } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, errorMessage, HttpError } from '@/lib/api';
import type { Address, CheckoutResponse, PaymentMethod, PaymentSession } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { queryKeys, useCartQuote, useHydrated, usePaymentConfig } from '@/lib/hooks';
import { openRazorpay } from '@/lib/razorpay';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import AddressForm from '@/components/checkout/AddressForm';
import BillSummary from '@/components/checkout/BillSummary';
import CouponBox from '@/components/checkout/CouponBox';
import ReservationTimer from '@/components/checkout/ReservationTimer';
import StripePaymentForm, { stripeConfigured } from '@/components/checkout/StripePaymentForm';
import UpiPayPanel from '@/components/checkout/UpiPayPanel';
import ProductImage from '@/components/product/ProductImage';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

interface MethodOption {
  id: PaymentMethod;
  title: string;
  text: string;
  icon: typeof CreditCard;
  badge?: string;
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold">
        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold', done ? 'bg-brand-500 text-white' : 'bg-mint text-brand-700')}>
          {done ? <Check size={14} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function CheckoutPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const qc = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const couponCode = useCartStore((s) => s.couponCode);
  const clearCart = useCartStore((s) => s.clearCart);
  const moveToStore = useCartStore((s) => s.moveToStore);
  const match = useLocationStore((s) => s.match);
  const setMatch = useLocationStore((s) => s.setMatch);
  const gpsLat = useLocationStore((s) => s.latitude);
  const gpsLng = useLocationStore((s) => s.longitude);
  const quote = useCartQuote();
  const payCfg = usePaymentConfig();

  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: api.addresses.list, enabled: !!user });
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('MOCK_ONLINE');
  const [placing, setPlacing] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [paying, setPaying] = useState(false);
  const idemKey = useRef<string>(newKey());

  useEffect(() => {
    if (authStatus === 'guest') router.replace('/login?next=/checkout');
  }, [authStatus, router]);

  useEffect(() => {
    const list = addresses.data;
    if (!list) return;
    if (list.length === 0) setAdding(true);
    else if (addressId === null || !list.some((a) => a.id === addressId)) setAddressId((list.find((a) => a.isDefault) ?? list[0]).id);
  }, [addresses.data, addressId]);

  // Make sure the cart is fulfilled by the dark store nearest the chosen address.
  const selected: Address | undefined = addresses.data?.find((a) => a.id === addressId);
  useEffect(() => {
    if (!selected || selected.latitude == null || selected.longitude == null) { setZoneError(null); return; }
    let cancelled = false;
    api.stores.nearest(selected.latitude, selected.longitude).then((m) => {
      if (cancelled) return;
      if (!m.serviceable) {
        setZoneError(`We don't deliver to this address yet — the nearest hub (${m.store.name}) is ${m.distanceKm.toFixed(0)} km away.`);
        return;
      }
      setZoneError(null);
      if (match && m.store.id !== match.store.id) {
        moveToStore(m.store.id);
        setMatch(m, { latitude: selected.latitude as number, longitude: selected.longitude as number }, selected.pincode, true);
        toast.info(`Switched to ${m.store.name} — nearest to this address. Prices and stock refreshed.`);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [selected, match, moveToStore, setMatch]);

  const cfg = payCfg.data;
  const stripeAvailable = !!cfg?.stripeEnabled && stripeConfigured;
  const methods = useMemo<MethodOption[]>(() => {
    const list: MethodOption[] = [];
    if (cfg?.upiEnabled) list.push({ id: 'UPI', title: 'UPI · Google Pay / PhonePe / Paytm', text: cfg.upiMode === 'RAZORPAY' ? 'UPI apps, QR or UPI ID via Razorpay' : 'Pay from any UPI app — QR on desktop, app buttons on phone', icon: Smartphone, badge: 'Fastest' });
    if (cfg?.razorpayEnabled) list.push({ id: 'RAZORPAY', title: 'Cards, Netbanking & Wallets', text: `Razorpay secure checkout${cfg.razorpayTestMode ? ' · test mode' : ''}`, icon: CreditCard });
    if (cfg?.phonepeEnabled) list.push({ id: 'PHONEPE', title: 'PhonePe', text: `PhonePe payment page${cfg.phonepeSandbox ? ' · sandbox' : ''}`, icon: Wallet });
    if (stripeAvailable) list.push({ id: 'STRIPE', title: 'International cards', text: 'Secured by Stripe', icon: CreditCard });
    if (cfg?.mockEnabled !== false) list.push({ id: 'MOCK_ONLINE', title: 'Demo pay (mock gateway)', text: 'Simulated success / failure — for testing', icon: Zap });
    if (cfg?.codEnabled !== false) list.push({ id: 'CASH_ON_DELIVERY', title: 'Cash on delivery', text: 'Pay the rider with cash or UPI', icon: Banknote });
    return list;
  }, [cfg, stripeAvailable]);

  useEffect(() => {
    if (methods.length > 0 && !methods.some((m) => m.id === method)) setMethod(methods[0].id);
  }, [methods, method]);

  const goTrack = useCallback(
    (orderId: number) => {
      clearCart();
      setCheckout(null);
      setSession(null);
      void qc.invalidateQueries({ queryKey: queryKeys.orders });
      void qc.invalidateQueries({ queryKey: ['top-savers'] });
      void qc.invalidateQueries({ queryKey: ['products-infinite'] });
      router.push(`/orders/${orderId}/track`);
    },
    [clearCart, qc, router],
  );

  /** Hands the session to the right gateway UI. */
  const runSession = useCallback(async (res: CheckoutResponse, s: PaymentSession) => {
    const orderId = res.order.id;
    if (s.mode === 'NONE') {
      toast.success(`Order ${res.order.orderNumber} placed!`);
      goTrack(orderId);
      return;
    }
    if (s.mode === 'PHONEPE' && s.phonepe) {
      toast.loading('Redirecting to PhonePe…');
      window.location.href = s.phonepe.redirectUrl;
      return;
    }
    if (s.mode === 'RAZORPAY' && s.razorpay) {
      setSession(s);
      setPaying(true);
      try {
        const r = await openRazorpay(s.razorpay);
        const order = await api.payments.verifyRazorpay(orderId, {
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          razorpaySignature: r.razorpay_signature,
        });
        toast.success('Payment successful 🎉');
        goTrack(order.id);
      } catch (e) {
        if ((e as Error).message === 'dismissed') toast.info('Payment window closed. Your items stay reserved until the timer ends.');
        else toast.error(errorMessage(e));
      } finally {
        setPaying(false);
      }
      return;
    }
    setSession(s); // STRIPE, UPI (direct) and MOCK render in the modal
  }, [goTrack]);

  useEffect(() => {
    const onFail = (e: Event) => toast.error((e as CustomEvent<string>).detail);
    window.addEventListener('qc:razorpay-failed', onFail);
    return () => window.removeEventListener('qc:razorpay-failed', onFail);
  }, []);

  const place = async () => {
    if (!match) return;
    setPlacing(true);
    try {
      const res = await api.checkout.place({
        storeId: match.store.id,
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        couponCode: couponCode && quote.data?.coupon?.applied ? couponCode : null,
        addressId,
        latitude: gpsLat,
        longitude: gpsLng,
        paymentMethod: method,
      }, idemKey.current);
      idemKey.current = newKey();
      setCheckout(res);
      await runSession(res, res.payment);
    } catch (e) {
      toast.error(errorMessage(e));
      if (e instanceof HttpError && (e.status === 409 || e.status === 400)) void quote.refetch();
      if (e instanceof HttpError && e.status !== 409) idemKey.current = newKey();
    } finally {
      setPlacing(false);
    }
  };

  const retryPayment = async () => {
    if (!checkout) return;
    setPlacing(true);
    try {
      const s = await api.payments.session(checkout.order.id);
      await runSession(checkout, s);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPlacing(false);
    }
  };

  const mockPay = async (success: boolean) => {
    if (!checkout) return;
    setPaying(true);
    try {
      const order = await api.payments.mockConfirm(checkout.order.id, success);
      if (order.status === 'PAYMENT_FAILED' || !success) {
        toast.error('Payment failed — your reserved stock was released. You can try again.');
        setSession(null);
        setCheckout(null);
        void quote.refetch();
      } else {
        toast.success('Payment successful 🎉');
        goTrack(order.id);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  const stripePaid = async () => {
    if (!checkout) return;
    try { await api.payments.verifyStripe(checkout.order.id); } catch { /* webhook will confirm */ }
    toast.success('Payment successful 🎉');
    goTrack(checkout.order.id);
  };

  const onExpire = useCallback(() => {
    toast.error('Your 10-minute reservation expired. Stock has been released.');
    setSession(null);
    setCheckout(null);
  }, []);

  if (!hydrated || authStatus === 'unknown') return <div className="container pt-10"><Spinner className="text-brand-500" /></div>;
  if (items.length === 0 && !checkout) {
    return <div className="container pt-10"><EmptyState emoji="🧺" title="Nothing to check out" action={<Link href="/" className="btn-primary">Continue shopping</Link>} /></div>;
  }

  const addressCount = addresses.data?.length ?? 0;
  const blockReason: string | null = !match
    ? 'Choose a delivery location first.'
    : addresses.isError
      ? "We couldn't load your addresses. Retry above."
      : adding
        ? 'Save your delivery address above to continue.'
        : !addressId
          ? addressCount === 0 ? 'Add a delivery address to continue.' : 'Select a delivery address above.'
          : zoneError
            ? zoneError
            : quote.isError
              ? "Couldn't calculate your bill. Check that the server is running."
              : !quote.data
                ? 'Calculating your bill…'
                : !quote.data.allInStock
                  ? 'Some items went out of stock — update your cart.'
                  : null;

  const onPlaceClick = () => {
    if (checkout && checkout.order.status === 'CREATED') return void retryPayment();
    if (blockReason) {
      toast.error(blockReason);
      if (adding || !addressId || addresses.isError) document.getElementById('address-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    void place();
  };

  const modalSession = session && (session.mode === 'STRIPE' || session.mode === 'UPI' || session.mode === 'MOCK') ? session : null;
  const awaitingPayment = !!checkout && checkout.order.status === 'CREATED';

  return (
    <div className="container pt-6">
      <h1 className="font-display text-2xl font-bold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <div id="address-step" className="scroll-mt-28" />
          <Step n={1} title="Delivery address" done={!!addressId && !adding && !zoneError}>
            {match && (
              <p className="mb-3 flex items-center gap-2 rounded-lg bg-mint px-3 py-2 text-xs text-brand-800">
                <Timer size={13} /> Fulfilled by <b>{match.store.name}</b> · arriving in ~{quote.data?.etaMinutes ?? match.etaMinutes} mins
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(addresses.data ?? []).map((a) => (
                <div
                  key={a.id}
                  role="radio"
                  aria-checked={addressId === a.id}
                  tabIndex={0}
                  onClick={() => setAddressId(a.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setAddressId(a.id)}
                  className={clsx('relative cursor-pointer rounded-lg border p-3 pr-9 transition', addressId === a.id ? 'border-brand-500 bg-mint/60 ring-1 ring-brand-500' : 'border-line hover:border-brand-300')}
                >
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {a.label === 'Home' ? <Home size={14} /> : <MapPin size={14} />} {a.label ?? 'Address'}
                    {a.isDefault && <span className="chip bg-white py-0.5 text-[9px] text-brand-700">DEFAULT</span>}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">{a.fullText}</p>
                  {a.landmark && <p className="text-[11px] text-ink-muted">Near {a.landmark}</p>}
                  {a.contactName && <p className="mt-1 text-[11px] text-ink-muted">{a.contactName}{a.contactPhone ? ` · ${a.contactPhone}` : ''}</p>}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try { await api.addresses.remove(a.id); void addresses.refetch(); } catch (err) { toast.error(errorMessage(err)); }
                    }}
                    className="absolute right-2 top-2 p-1 text-ink-muted hover:text-danger"
                    aria-label="Delete address"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {addresses.isLoading && <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Loading addresses…</p>}
            {addresses.isError && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-danger">
                Couldn&apos;t load your saved addresses ({(addresses.error as Error).message}).{' '}
                <button onClick={() => addresses.refetch()} className="font-bold underline">Retry</button>
              </div>
            )}
            {zoneError && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{zoneError}</p>}
            {adding ? (
              <div className="mt-3">
                <AddressForm
                  onSaved={(a) => { setAdding(false); setAddressId(a.id); void addresses.refetch(); }}
                  onCancel={addressCount > 0 ? () => setAdding(false) : undefined}
                />
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">
                <Plus size={15} /> Add new address
              </button>
            )}
          </Step>

          <Step n={2} title="Payment method">
            <div className="space-y-2.5">
              {payCfg.isLoading && <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Loading payment options…</p>}
              {methods.map((m) => (
                <label key={m.id} className={clsx('flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition', method === m.id ? 'border-brand-500 bg-mint/60' : 'border-line hover:border-brand-300', awaitingPayment && 'pointer-events-none opacity-60')}>
                  <input type="radio" name="pm" checked={method === m.id} onChange={() => setMethod(m.id)} className="accent-brand-500" disabled={awaitingPayment} />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm"><m.icon size={17} /></span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold">{m.title}{m.badge && <span className="chip bg-brand-500 py-0.5 text-[9px] text-white">{m.badge}</span>}</span>
                    <span className="block text-[11px] text-ink-muted">{m.text}</span>
                  </span>
                </label>
              ))}
              {cfg && !cfg.razorpayEnabled && !cfg.phonepeEnabled && !cfg.upiEnabled && (
                <p className="text-[11px] text-ink-muted">Add RAZORPAY_KEY_ID / PHONEPE_CLIENT_ID / UPI_VPA on the backend to enable live UPI, card and wallet payments.</p>
              )}
              <p className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-muted"><ShieldCheck size={12} className="text-brand-600" /> Card data never touches QuickCart — gateways are PCI-DSS compliant.</p>
            </div>
          </Step>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h3 className="mb-3 font-display text-sm font-bold">Order summary · {items.length} items</h3>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {items.map((i) => (
                <div key={i.id} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mint" title={i.title}>
                  <ProductImage src={i.imageUrl} alt={i.title} size="sm" sizes="56px" />
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{i.quantity}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5"><CouponBox quote={quote.data} /></div>
          <div className="card p-5">
            {quote.data ? <BillSummary quote={quote.data} /> : <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Calculating…</p>}
            {awaitingPayment && checkout?.reservationExpiresAt && (
              <div className="mt-4"><ReservationTimer expiresAt={checkout.reservationExpiresAt} onExpire={onExpire} /></div>
            )}
            <button
              onClick={onPlaceClick}
              disabled={placing || paying}
              aria-disabled={!!blockReason && !awaitingPayment}
              className={clsx('btn-primary mt-5 w-full py-3.5 text-sm', blockReason && !awaitingPayment && 'opacity-60 hover:bg-brand-500')}
            >
              {placing || paying ? <Spinner /> : null}
              {awaitingPayment ? 'Complete payment' : method === 'CASH_ON_DELIVERY' ? 'Place order' : 'Reserve & pay'}{' '}
              {quote.data ? formatPrice(checkout?.order.totalAmount ?? quote.data.total) : ''}
            </button>
            {blockReason && !awaitingPayment && (
              <p className="mt-2 text-center text-xs font-semibold text-danger">
                {blockReason}
                {quote.data && !quote.data.allInStock && <> <Link href="/cart" className="underline">Update cart</Link></>}
              </p>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={!!modalSession}
        onClose={() => !paying && setSession(null)}
        title={modalSession?.mode === 'STRIPE' ? 'Pay securely' : modalSession?.mode === 'UPI' ? 'Pay with UPI' : 'Demo pay (mock gateway)'}
      >
        {modalSession && checkout && (
          <div className="space-y-4">
            {checkout.reservationExpiresAt && <ReservationTimer expiresAt={checkout.reservationExpiresAt} onExpire={onExpire} />}
            <div className="flex items-center justify-between rounded-lg border border-line p-3 text-sm">
              <span>Order <b>{checkout.order.orderNumber}</b></span>
              <span className="font-display text-lg font-extrabold">{formatPrice(checkout.order.totalAmount)}</span>
            </div>
            {modalSession.mode === 'STRIPE' && modalSession.stripeClientSecret ? (
              <StripePaymentForm
                clientSecret={modalSession.stripeClientSecret}
                amount={Number(checkout.order.totalAmount)}
                returnUrl={`${window.location.origin}/orders/${checkout.order.id}/track?payment=stripe`}
                onPaid={stripePaid}
                onFailed={(m) => toast.error(m)}
              />
            ) : modalSession.mode === 'UPI' && modalSession.upi ? (
              <UpiPayPanel orderId={checkout.order.id} upi={modalSession.upi} onPaid={() => { toast.success('UPI payment received 🎉'); goTrack(checkout.order.id); }} />
            ) : (
              <div className="space-y-3">
                <button onClick={() => mockPay(true)} disabled={paying} className="btn-primary w-full py-3.5">
                  {paying ? <Spinner /> : null} Pay {formatPrice(checkout.order.totalAmount)} (simulate success)
                </button>
                <button onClick={() => mockPay(false)} disabled={paying} className="btn-outline w-full">Simulate payment failure</button>
                <p className="text-center text-[11px] text-ink-muted">Closing this window keeps the reservation until the timer ends, then stock is auto-released.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
