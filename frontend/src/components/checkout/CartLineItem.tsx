'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem } from '@/store/useCartStore';
import { MAX_PER_ITEM, useCartStore } from '@/store/useCartStore';
import type { QuoteLine } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import ProductImage from '../product/ProductImage';

export default function CartLineItem({ item, line, compact }: { item: CartItem; line?: QuoteLine; compact?: boolean }) {
  const addQty = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.deleteItem);
  const cap = Math.min(MAX_PER_ITEM, line?.availableQuantity ?? item.maxQuantity);
  const unit = line ? Number(line.unitPrice) : item.price;
  const mrp = line ? Number(line.mrp) : item.mrp;
  const short = line && !line.inStock;

  return (
    <div className="flex gap-3 py-3">
      <Link href={`/product/${item.id}`} className={compact ? 'h-14 w-14 shrink-0 rounded-lg bg-mint' : 'h-20 w-20 shrink-0 rounded-lg bg-mint'}>
        <ProductImage src={item.imageUrl} alt={item.title} size={compact ? 'sm' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/product/${item.id}`} className="line-clamp-2 text-[13px] font-semibold leading-5 hover:text-brand-700">
          {item.title}
        </Link>
        <p className="text-[11px] text-ink-muted">{item.unitQuantity}</p>
        {short && (
          <p className="mt-0.5 text-[11px] font-bold text-danger">
            {line.availableQuantity === 0 ? 'Out of stock — remove to continue' : `Only ${line.availableQuantity} left`}
          </p>
        )}
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold">{formatPrice(unit * item.quantity)}</span>
          {mrp > unit && <span className="text-[11px] text-ink-muted line-through">{formatPrice(mrp * item.quantity)}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between">
        <button onClick={() => remove(item.id)} className="text-ink-muted hover:text-danger" aria-label={`Remove ${item.title}`}>
          <Trash2 size={14} />
        </button>
        <div className="flex h-8 items-center overflow-hidden rounded bg-brand-500 text-white">
          <button onClick={() => addQty(item.id, item.quantity - 1)} className="flex h-full w-7 items-center justify-center hover:bg-brand-600" aria-label="Decrease">
            <Minus size={13} />
          </button>
          <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
          <button
            onClick={() => addQty(item.id, item.quantity + 1)}
            disabled={item.quantity >= cap}
            className="flex h-full w-7 items-center justify-center hover:bg-brand-600 disabled:opacity-40"
            aria-label="Increase"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
