import Link from 'next/link';
import clsx from 'clsx';
import { Timer } from 'lucide-react';
import type { ProductCard as Product } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import ProductImage from './ProductImage';
import AddToCartButton from './AddToCartButton';
import WishlistButton from './WishlistButton';
import Stars from '../ui/Stars';

interface Props {
  product: Product;
  /** "row" = mockup Top Saver card (text left, packshot right); "grid" = vertical browse tile. */
  layout?: 'row' | 'grid';
}

function DiscountTag({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <span className="absolute left-0 top-3 z-10 rounded-r bg-brand-500 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-white">
      {percent}% OFF
    </span>
  );
}

function StockBadge({ product }: { product: Product }) {
  const badge = product.badges.find((b) => b !== '10 MINS');
  if (!badge) return null;
  const out = product.stockStatus === 'OUT_OF_STOCK';
  return (
    <span className={clsx('chip', out ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-700')}>{badge}</span>
  );
}

/** "42 sold · 18 left" with a bar showing how much of this store's limit is gone. */
export function StockMeter({ product, compact }: { product: Product; compact?: boolean }) {
  const left = product.stockQuantity;
  const sold = product.soldCount ?? 0;
  const total = left + sold;
  const pct = total > 0 ? Math.round((sold / total) * 100) : 100;
  const out = product.stockStatus === 'OUT_OF_STOCK';
  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className="text-ink-muted">{sold > 0 ? `🔥 ${sold} sold` : 'New arrival'}</span>
        <span className={out ? 'text-danger' : left < 10 ? 'text-amber-600' : 'text-brand-700'}>{out ? 'Sold out' : `${left} left`}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
        <div className={clsx('h-full rounded-full', out ? 'bg-danger' : left < 10 ? 'bg-amber-400' : 'bg-brand-400')} style={{ width: `${out ? 100 : Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

export default function ProductCard({ product, layout = 'row' }: Props) {
  const href = `/product/${product.id}`;
  const out = product.stockStatus === 'OUT_OF_STOCK';
  const fast = product.badges.includes('10 MINS');

  if (layout === 'grid') {
    return (
      <article className={clsx('card group relative flex h-full flex-col p-3 transition hover:shadow-card', out && 'opacity-70')}>
        <DiscountTag percent={product.discountPercent} />
        <Link href={href} className="relative mb-2 block aspect-square overflow-hidden rounded-md bg-mint/50">
          <ProductImage src={product.imageUrl} srcB={product.imageUrlB} productId={product.id} alt={product.imageAlt ?? product.title} size="md" sizes="(max-width: 640px) 45vw, 200px" className="transition duration-300 group-hover:scale-105" />
        </Link>
        {fast && (
          <span className="mb-1 inline-flex w-fit items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-ink-soft">
            <Timer size={10} /> 10 mins
          </span>
        )}
        <Link href={href} className="line-clamp-2 min-h-[2.5rem] font-display text-[13px] font-bold leading-5 hover:text-brand-700">
          {product.title}
        </Link>
        <p className="mt-0.5 text-[11px] text-ink-muted">{product.unitQuantity}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <Stars rating={product.rating} size={10} />
          <StockBadge product={product} />
        </div>
        <StockMeter product={product} compact />
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-brand-600">{formatPrice(product.salePrice)}</p>
            {product.mrp > product.salePrice && <p className="text-[11px] text-ink-muted line-through">{formatPrice(product.mrp)}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <WishlistButton productId={product.id} />
            <AddToCartButton product={product} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={clsx('card group relative flex min-h-[152px] gap-2 overflow-hidden p-4 pt-10 transition hover:shadow-card', out && 'opacity-75')}>
      <DiscountTag percent={product.discountPercent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={href} className="line-clamp-2 font-display text-[15px] font-bold leading-5 hover:text-brand-700">
          {product.title}
        </Link>
        <div className="mt-1.5 flex items-center gap-2">
          <Stars rating={product.rating} />
          <StockBadge product={product} />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-base font-extrabold text-brand-600">{formatPrice(product.salePrice)}</span>
          <span className="text-xs text-ink-muted">/ {product.unitQuantity}</span>
        </div>
        {product.mrp > product.salePrice && <span className="text-[11px] text-ink-muted line-through">MRP {formatPrice(product.mrp)}</span>}
        <StockMeter product={product} />
        <div className="mt-auto flex items-center gap-2 pt-3">
          <WishlistButton productId={product.id} />
          <AddToCartButton product={product} />
        </div>
      </div>
      <Link href={href} className="relative -mt-6 h-[118px] w-[104px] shrink-0 overflow-hidden rounded-lg">
        <ProductImage src={product.imageUrl} srcB={product.imageUrlB} productId={product.id} alt={product.imageAlt ?? product.title} size="md" sizes="120px" className="transition duration-300 group-hover:-translate-y-1" />
      </Link>
    </article>
  );
}

export function ProductCardSkeleton({ layout = 'row' }: { layout?: 'row' | 'grid' }) {
  return layout === 'grid' ? (
    <div className="card animate-pulse p-3">
      <div className="mb-3 aspect-square rounded-md bg-zinc-100" />
      <div className="mb-2 h-3 w-4/5 rounded bg-zinc-100" />
      <div className="mb-4 h-3 w-2/5 rounded bg-zinc-100" />
      <div className="h-8 w-full rounded bg-zinc-100" />
    </div>
  ) : (
    <div className="card flex h-[152px] animate-pulse gap-3 p-4">
      <div className="flex-1 space-y-2 pt-6">
        <div className="h-3 w-4/5 rounded bg-zinc-100" />
        <div className="h-3 w-3/5 rounded bg-zinc-100" />
        <div className="h-4 w-2/5 rounded bg-zinc-100" />
      </div>
      <div className="h-full w-24 rounded bg-zinc-100" />
    </div>
  );
}
