'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { isImageUrl, resolveImageUrl } from '@/lib/format';
import { trackImpression, variantFor } from '@/lib/abTest';

interface Props {
  src: string | null | undefined;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  tint?: string | null;
  /** Emoji shown if the photo fails to load (or none is set yet). */
  fallback?: string;
  /** Responsive sizes hint for srcset, e.g. "(max-width: 640px) 50vw, 200px". */
  sizes?: string;
  priority?: boolean;
  /** When set together with srcB, the visitor's A/B variant is shown and impressions are recorded. */
  productId?: number;
  srcB?: string | null;
}

const EMOJI_SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'text-xl',
  sm: 'text-3xl',
  md: 'text-6xl',
  lg: 'text-7xl',
  xl: 'text-[9rem]',
};

const DEFAULT_SIZES: Record<NonNullable<Props['size']>, string> = {
  xs: '48px',
  sm: '96px',
  md: '(max-width: 640px) 45vw, 220px',
  lg: '(max-width: 640px) 60vw, 320px',
  xl: '(max-width: 768px) 100vw, 600px',
};

/** Uploaded photos (/uploads/…) are served through the same-origin /media proxy so Next can optimise them. */
function optimisableSrc(src: string): string {
  return src.startsWith('/uploads/') ? `/media/${src.slice('/uploads/'.length)}` : src;
}

/**
 * Product photo pipeline on the client: next/image negotiates AVIF/WebP, builds a responsive srcset, lazy-loads
 * off-screen images and caches optimised variants. If optimisation fails we fall back to the original URL,
 * and products without a photo show an illustrated emoji placeholder.
 */
export default function ProductImage({ src, alt, size = 'md', className, tint, fallback, sizes, priority, productId, srcB }: Props) {
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 optimised, 1 direct, 2 emoji
  const ref = useRef<HTMLDivElement>(null);
  const hasB = !!srcB && isImageUrl(srcB) && productId !== undefined;

  useEffect(() => {
    if (hasB && productId !== undefined) setVariant(variantFor(productId, true));
  }, [hasB, productId]);

  const chosen = hasB && variant === 'B' ? (srcB as string) : src;
  useEffect(() => setStage(0), [chosen]);

  // Record an impression once the image is actually on screen (A/B tests only).
  useEffect(() => {
    if (!hasB || productId === undefined || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        trackImpression(productId, variant);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [hasB, productId, variant]);

  const real = isImageUrl(chosen) && stage < 2;
  return (
    <div
      ref={ref}
      className={clsx('relative flex h-full w-full items-center justify-center overflow-hidden', className)}
      style={tint ? { backgroundColor: tint } : undefined}
      role={real ? undefined : 'img'}
      aria-label={real ? undefined : alt}
    >
      {real ? (
        stage === 0 && !(chosen as string).startsWith('data:') ? (
          <Image
            src={optimisableSrc(chosen as string)}
            alt={alt}
            fill
            sizes={sizes ?? DEFAULT_SIZES[size]}
            priority={priority}
            quality={75}
            onError={() => setStage(1)}
            className={clsx('object-contain mix-blend-multiply', size === 'xs' ? 'p-0.5' : 'p-[8%]')}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(chosen as string)}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setStage(2)}
            className={clsx('h-full w-full object-contain mix-blend-multiply', size === 'xs' ? 'p-0.5' : 'p-[8%]')}
          />
        )
      ) : (
        <>
          <span className="absolute bottom-[14%] left-1/2 h-[8%] w-[46%] -translate-x-1/2 rounded-[50%] bg-black/10 blur-[3px]" />
          <span className={clsx('relative select-none leading-none drop-shadow-sm', EMOJI_SIZE[size])}>
            {isImageUrl(chosen) ? fallback ?? '🛒' : chosen || fallback || '🛒'}
          </span>
        </>
      )}
    </div>
  );
}
