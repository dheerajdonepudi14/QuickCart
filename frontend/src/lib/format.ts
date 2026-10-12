import type { OrderStatus } from './types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const formatPrice = (value: number | null | undefined): string => inr.format(Number(value ?? 0));
/** ₹1.2K / ₹3.4L / ₹1.1Cr — Intl's en-IN compact form prints thousands as "T", which reads like trillions. */
export const formatCompact = (value: number | null | undefined): string => {
  const v = Number(value ?? 0);
  const a = Math.abs(v);
  const fmt = (n: number, unit: string) => `₹${Number(n.toFixed(n < 10 ? 1 : 0))}${unit}`;
  if (a >= 1e7) return fmt(v / 1e7, 'Cr');
  if (a >= 1e5) return fmt(v / 1e5, 'L');
  if (a >= 1e3) return fmt(v / 1e3, 'K');
  return `₹${Math.round(v)}`;
};

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Awaiting payment',
  ORDER_PLACED: 'Order placed',
  PACKING_IN_PROGRESS: 'Packing in progress',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Reservation expired',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  CREATED: 'bg-amber-50 text-amber-700',
  ORDER_PLACED: 'bg-sky-50 text-sky-700',
  PACKING_IN_PROGRESS: 'bg-violet-50 text-violet-700',
  OUT_FOR_DELIVERY: 'bg-orange-50 text-orange-700',
  DELIVERED: 'bg-brand-50 text-brand-700',
  PAYMENT_FAILED: 'bg-red-50 text-red-700',
  EXPIRED: 'bg-zinc-100 text-zinc-600',
  CANCELLED: 'bg-red-50 text-red-700',
};

export const ACTIVE_STATUSES: OrderStatus[] = ['CREATED', 'ORDER_PLACED', 'PACKING_IN_PROGRESS', 'OUT_FOR_DELIVERY'];

export const isImageUrl = (value?: string | null): boolean =>
  !!value && (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:'));

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

/** Uploaded photos live on the backend (/uploads/**); everything else is used as-is. */
export const resolveImageUrl = (value: string): string => (value.startsWith('/uploads/') ? `${API_BASE}${value}` : value);

export const formatCount = (n: number | null | undefined): string => new Intl.NumberFormat('en-IN').format(Number(n ?? 0));
