'use client';

import { Minus, Plus, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import type { ProductCard } from '@/lib/types';
import { toCartProduct, useCartStore, MAX_PER_ITEM } from '@/store/useCartStore';
import { useStoreId } from '@/store/useLocationStore';
import { useUIStore } from '@/store/useUIStore';
import { useHydrated } from '@/lib/hooks';
import { trackAddToCart } from '@/lib/abTest';

interface Props {
  product: ProductCard;
  variant?: 'icon' | 'wide';
  className?: string;
}

export default function AddToCartButton({ product, variant = 'icon', className }: Props) {
  const hydrated = useHydrated();
  const storeId = useStoreId();
  const qty = useCartStore((s) => s.items.find((i) => i.id === product.id)?.quantity ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const openCart = useUIStore((s) => s.openCart);
  const out = product.stockStatus === 'OUT_OF_STOCK' || product.stockQuantity <= 0;
  const cap = Math.min(MAX_PER_ITEM, product.stockQuantity);

  const add = () => {
    if (!storeId) {
      toast.error('Pick a delivery location first');
      return;
    }
    if (qty >= cap) {
      toast.warning(cap <= 0 ? 'Out of stock' : `Out of stock beyond ${cap} — that's all this store has right now`);
      return;
    }
    addItem(toCartProduct(product, storeId));
    if (qty === 0) trackAddToCart(product.id, !!product.imageUrlB);
    if (qty === 0) {
      toast.success(`${product.title} added`, {
        action: { label: 'View cart', onClick: openCart },
        duration: 1800,
      });
    }
  };

  if (out) {
    return (
      <button disabled className={clsx(variant === 'wide' ? 'btn-outline w-full' : 'icon-btn opacity-50', className)} aria-label="Out of stock">
        {variant === 'wide' ? 'Out of stock' : <ShoppingCart size={14} />}
      </button>
    );
  }

  if (hydrated && qty > 0) {
    return (
      <div
        className={clsx(
          'inline-flex items-center overflow-hidden rounded bg-brand-500 text-white',
          variant === 'wide' ? 'h-10 w-full justify-between' : 'h-8',
          className,
        )}
      >
        <button onClick={() => removeItem(product.id)} className="flex h-full w-8 items-center justify-center hover:bg-brand-600" aria-label="Decrease quantity">
          <Minus size={14} />
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums">{qty}</span>
        <button
          onClick={add}
          disabled={qty >= cap}
          className="flex h-full w-8 items-center justify-center hover:bg-brand-600 disabled:opacity-50"
          aria-label="Increase quantity"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return variant === 'wide' ? (
    <button onClick={add} className={clsx('btn-primary w-full', className)}>
      <ShoppingCart size={15} /> Add to cart
    </button>
  ) : (
    <button onClick={add} className={clsx('icon-btn', className)} aria-label={`Add ${product.title} to cart`}>
      <ShoppingCart size={14} />
    </button>
  );
}
