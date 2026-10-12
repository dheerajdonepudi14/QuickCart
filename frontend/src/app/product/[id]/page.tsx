'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ChevronRight, RotateCcw, Timer, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/hooks';
import { formatPrice } from '@/lib/format';
import { useLocationStore, useStoreId } from '@/store/useLocationStore';
import ProductImage from '@/components/product/ProductImage';
import AddToCartButton from '@/components/product/AddToCartButton';
import WishlistButton from '@/components/product/WishlistButton';
import ProductCard from '@/components/product/ProductCard';
import Stars from '@/components/ui/Stars';
import EmptyState from '@/components/ui/EmptyState';

function prettyKey(k: string): string {
  return k.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const storeId = useStoreId();
  const eta = useLocationStore((s) => s.match?.etaMinutes);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.product(storeId, id),
    queryFn: () => api.catalog.product(storeId as number, id),
    enabled: storeId !== null && Number.isFinite(id),
  });

  if (isError) {
    return <div className="container pt-10"><EmptyState emoji="🥲" title="Product unavailable" text={(error as Error).message} action={<Link href="/" className="btn-primary">Back to shopping</Link>} /></div>;
  }
  if (isLoading || !data) {
    return (
      <div className="container grid animate-pulse gap-10 pt-8 md:grid-cols-2">
        <div className="aspect-square rounded-xl bg-mint" />
        <div className="space-y-4"><div className="h-8 w-3/4 rounded bg-zinc-100" /><div className="h-4 w-1/3 rounded bg-zinc-100" /><div className="h-10 w-1/2 rounded bg-zinc-100" /></div>
      </div>
    );
  }

  const p = data.product;
  const attrs = Object.entries(data.attributes ?? {}).filter(([, v]) => v !== null && v !== '');
  return (
    <div className="container pt-5">
      <nav className="mb-5 flex items-center gap-1 text-xs text-ink-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">Home</Link><ChevronRight size={12} />
        <Link href={`/browse/${p.categorySlug}`} className="hover:text-brand-700">{p.categoryName}</Link><ChevronRight size={12} />
        <span className="truncate font-semibold text-ink">{p.title}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-mint">
          {p.discountPercent > 0 && (
            <span className="absolute left-0 top-5 z-10 rounded-r bg-brand-500 px-3 py-1 text-xs font-bold text-white">{p.discountPercent}% OFF</span>
          )}
          <ProductImage src={p.imageUrl} srcB={p.imageUrlB} productId={p.id} alt={p.imageAlt ?? p.title} size="xl" priority />
        </div>

        <div>
          {p.brand && <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{p.brand}</p>}
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight md:text-3xl">{p.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
            <Stars rating={p.rating} size={13} /> <span>{p.rating.toFixed(1)} rating</span> · <span>{p.unitQuantity}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.badges.map((b) => (
              <span key={b} className={b === 'Out of Stock' ? 'chip bg-zinc-100 text-zinc-500' : b === '10 MINS' ? 'chip bg-mint text-brand-700' : 'chip bg-amber-50 text-amber-700'}>
                {b === '10 MINS' && <Timer size={11} />} {b}
              </span>
            ))}
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-3xl font-extrabold text-brand-600">{formatPrice(p.salePrice)}</span>
            {p.mrp > p.salePrice && <span className="text-base text-ink-muted line-through">MRP {formatPrice(p.mrp)}</span>}
          </div>
          <p className="text-[11px] text-ink-muted">Inclusive of all taxes</p>

          <div className="mt-6 flex max-w-sm items-center gap-3">
            <AddToCartButton product={p} variant="wide" />
            <WishlistButton productId={p.id} className="h-10 w-10" />
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-[11px] text-ink-soft">
            <div className="rounded-lg bg-mint p-3"><Truck className="mx-auto mb-1 text-brand-600" size={20} strokeWidth={1.5} />Delivery in {eta ?? 10} mins</div>
            <div className="rounded-lg bg-mint p-3"><BadgeCheck className="mx-auto mb-1 text-brand-600" size={20} strokeWidth={1.5} />Verified brand</div>
            <div className="rounded-lg bg-mint p-3"><RotateCcw className="mx-auto mb-1 text-brand-600" size={20} strokeWidth={1.5} />Easy returns</div>
          </div>

          {data.description && (
            <div className="mt-8">
              <h2 className="mb-2 font-display text-base font-bold">Product details</h2>
              <p className="text-sm leading-6 text-ink-soft">{data.description}</p>
            </div>
          )}
          {attrs.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-line p-4 text-sm">
              {attrs.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase text-ink-muted">{prettyKey(k)}</dt>
                  <dd className="font-semibold">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {data.frequentlyBoughtTogether.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-5">Frequently bought together</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.frequentlyBoughtTogether.map((x) => <ProductCard key={x.id} product={x} layout="grid" />)}
          </div>
        </section>
      )}
      {data.similar.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-5">Similar products</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.similar.map((x) => <ProductCard key={x.id} product={x} />)}
          </div>
        </section>
      )}
    </div>
  );
}
