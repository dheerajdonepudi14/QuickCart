'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { PaymentStatus, UpiCheckout } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import Spinner from '../ui/Spinner';

const APP_STYLE: Record<string, string> = {
  'Google Pay': 'bg-white border-line',
  PhonePe: 'bg-[#F3EEFB] border-[#E2D6F7]',
  Paytm: 'bg-[#EAF6FD] border-[#CDE9F8]',
};

/**
 * Direct UPI (Google Pay / PhonePe / Paytm / BHIM): QR on desktop, app buttons on phones. After paying, the
 * shopper confirms (optionally with the 12-digit UTR) and we poll until the payment is verified.
 */
export default function UpiPayPanel({ orderId, upi, onPaid }: { orderId: number; upi: UpiCheckout; onPaid: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!submitted) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await api.payments.status(orderId);
        if (stop) return;
        setStatus(s);
        if (s.orderStatus !== 'CREATED') {
          if (s.orderStatus === 'PAYMENT_FAILED' || s.orderStatus === 'EXPIRED') toast.error('UPI payment could not be verified.');
          else onPaid();
          stop = true;
        }
      } catch { /* keep polling */ }
    };
    void tick();
    const t = setInterval(() => { if (!stop) void tick(); }, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [submitted, orderId, onPaid]);

  const confirm = async () => {
    if (utr && !/^\d{12}$/.test(utr)) return toast.error('The UTR is the 12-digit number in your UPI app (optional).');
    setBusy(true);
    try {
      setStatus(await api.payments.upiSubmitted(orderId, utr || undefined));
      setSubmitted(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Spinner className="h-8 w-8 text-brand-500" />
        <p className="font-display text-base font-bold">Verifying your UPI payment…</p>
        <p className="max-w-xs text-xs text-ink-muted">
          {status?.message ?? 'This usually takes a few seconds. Keep this window open — we’ll take you to tracking automatically.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-mint px-3 py-2 text-xs">
        <span>Pay <b>{upi.payeeName}</b> · <span className="font-mono">{upi.vpa}</span></span>
        <b className="text-sm">{formatPrice(upi.amount)}</b>
      </div>

      {isMobile ? (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(upi.appUris).map(([name, uri]) => (
            <a key={name} href={uri} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold ${APP_STYLE[name] ?? 'bg-white border-line'}`}>
              <Smartphone size={15} /> {name}
            </a>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-line bg-white p-3">
            <QRCodeSVG value={upi.uri} size={190} level="M" marginSize={1} />
          </div>
          <p className="text-center text-[11px] text-ink-muted">Scan with Google Pay, PhonePe, Paytm, BHIM or any UPI app</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="utr">UPI transaction ID / UTR (optional)</label>
        <input id="utr" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" placeholder="12-digit reference from your UPI app" className="input" />
      </div>
      <button onClick={confirm} disabled={busy} className="btn-primary w-full py-3.5">
        {busy ? <Spinner /> : <CheckCircle2 size={16} />} I’ve completed the payment
      </button>
      {upi.sandboxAutoConfirm && (
        <p className="text-center text-[10px] text-ink-muted">Sandbox mode: payments auto-confirm a few seconds after you tap the button.</p>
      )}
    </div>
  );
}
