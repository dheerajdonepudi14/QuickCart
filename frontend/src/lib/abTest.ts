'use client';

import { api } from './api';

/**
 * Image A/B testing on the storefront. Each visitor gets a stable random id; the variant for a product is a
 * hash of (visitor, product), so a shopper always sees the same photo. Impressions and add-to-carts are
 * batched and sent to /api/v1/events/images.
 */
const VISITOR_KEY = 'qc-visitor-id';
let visitorId: string | null = null;

function visitor(): string {
  if (visitorId) return visitorId;
  try {
    visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
  } catch {
    visitorId = 'anonymous';
  }
  return visitorId;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Variant = 'A' | 'B';

export function variantFor(productId: number, hasB: boolean): Variant {
  if (!hasB || typeof window === 'undefined') return 'A';
  return hash(`${visitor()}:${productId}`) % 2 === 0 ? 'A' : 'B';
}

type Event = { productId: number; variant: Variant; type: 'impression' | 'add_to_cart' };
const queue: Event[] = [];
const seen = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, 100);
  api.events.images(batch).catch(() => undefined);
  if (queue.length > 0) schedule();
}

function schedule() {
  if (!timer) timer = setTimeout(flush, 4000);
}

/** Records an impression once per page load per product. */
export function trackImpression(productId: number, variant: Variant) {
  const key = `${productId}:${variant}`;
  if (seen.has(key)) return;
  seen.add(key);
  queue.push({ productId, variant, type: 'impression' });
  schedule();
}

export function trackAddToCart(productId: number, hasB: boolean) {
  if (!hasB) return;
  queue.push({ productId, variant: variantFor(productId, true), type: 'add_to_cart' });
  schedule();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
}
