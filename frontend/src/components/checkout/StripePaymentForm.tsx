'use client';

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import Spinner from '../ui/Spinner';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
let stripePromise: Promise<Stripe | null> | null = null;
export const stripeConfigured = publishableKey.length > 0;
const getStripe = () => {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
};

interface Props {
  clientSecret: string;
  amount: number;
  returnUrl: string;
  onPaid: () => void;
  onFailed: (message: string) => void;
}

function Inner({ amount, returnUrl, onPaid, onFailed }: Omit<Props, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });
    setBusy(false);
    if (err) {
      setError(err.message ?? 'Payment failed');
      onFailed(err.message ?? 'Payment failed');
      return;
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) onPaid();
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>}
      <button type="submit" disabled={!stripe || busy} className="btn-primary w-full py-3.5">
        {busy ? <Spinner /> : <ShieldCheck size={16} />} Pay {formatPrice(amount)}
      </button>
      <p className="text-center text-[11px] text-ink-muted">Test card: 4242 4242 4242 4242 · any future date · any CVC</p>
    </form>
  );
}

export default function StripePaymentForm(props: Props) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#22A04B', fontFamily: 'Mulish, system-ui, sans-serif', borderRadius: '8px' },
        },
      }}
    >
      <Inner amount={props.amount} returnUrl={props.returnUrl} onPaid={props.onPaid} onFailed={props.onFailed} />
    </Elements>
  );
}
