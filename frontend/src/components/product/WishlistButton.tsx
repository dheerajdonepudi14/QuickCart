'use client';

import { Heart } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useWishlistStore } from '@/store/useWishlistStore';
import { useHydrated } from '@/lib/hooks';

export default function WishlistButton({ productId, className }: { productId: number; className?: string }) {
  const hydrated = useHydrated();
  const active = useWishlistStore((s) => s.ids.includes(productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const on = hydrated && active;
  return (
    <button
      onClick={() => {
        const added = toggle(productId);
        toast(added ? 'Saved to wishlist' : 'Removed from wishlist', { duration: 1200 });
      }}
      className={clsx('icon-btn', on && 'border-rose-200 text-rose-500', className)}
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={on}
    >
      <Heart size={14} className={clsx(on && 'fill-rose-500')} />
    </button>
  );
}
