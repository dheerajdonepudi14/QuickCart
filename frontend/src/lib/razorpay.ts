import type { RazorpayCheckout } from './types';
import { loadScript } from './loadScript';

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string; code?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', cb: (r: RazorpayFailure) => void) => void;
}

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

/**
 * Opens Razorpay Checkout (cards, UPI incl. Google Pay / PhonePe intents & QR, netbanking, wallets).
 * Resolves with the signed result on success; rejects on dismissal or failure.
 */
export async function openRazorpay(c: RazorpayCheckout): Promise<RazorpaySuccess> {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout failed to load.');
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let settled = false;
    const options: Record<string, unknown> = {
      key: c.keyId,
      order_id: c.orderId,
      amount: c.amount,
      currency: c.currency,
      name: c.name,
      description: c.description,
      prefill: { name: c.prefillName ?? '', email: c.prefillEmail ?? '', contact: c.prefillContact ?? '' },
      theme: { color: c.themeColor },
      retry: { enabled: true, max_count: 3 },
      handler: (r: RazorpaySuccess) => { settled = true; resolve(r); },
      modal: {
        ondismiss: () => { if (!settled) reject(new Error('dismissed')); },
        confirm_close: true,
      },
    };
    if (c.preferredMethod === 'upi') {
      options.config = {
        display: {
          blocks: { upi: { name: 'Pay using UPI (Google Pay, PhonePe, Paytm…)', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: true },
        },
      };
    }
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (r) => {
      // Razorpay keeps the modal open for retries; we only surface the reason.
      const msg = r.error?.description ?? 'Payment failed';
      window.dispatchEvent(new CustomEvent('qc:razorpay-failed', { detail: msg }));
    });
    rzp.open();
  });
}
