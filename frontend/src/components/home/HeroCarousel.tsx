'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';

interface Slide {
  eyebrow: string;
  titleBold: string[];
  titleLight: string;
  text: string;
  href: string;
  bg: string;
  bag: string;
  items: { e: string; x: string; y: string; s: string; r?: number }[];
}

/** Illustrated hero compositions — an emoji "produce bag" standing in for the mockup photography. */
const SLIDES: Slide[] = [
  {
    eyebrow: 'All Natural Products',
    titleBold: ['Fresh and Healthy', 'Veggies'],
    titleLight: 'Organic Market',
    text: 'Organic food is food produced by methods that comply with the standards of organic farming.',
    href: '/browse/fruits-vegetables',
    bg: 'bg-hero',
    bag: '#D9C9A3',
    items: [
      { e: '🥦', x: '44%', y: '8%', s: '7.5rem', r: -8 },
      { e: '🥒', x: '66%', y: '0%', s: '6rem', r: 25 },
      { e: '🍅', x: '26%', y: '22%', s: '4.8rem' },
      { e: '🍅', x: '36%', y: '34%', s: '4rem', r: 12 },
      { e: '🍍', x: '6%', y: '38%', s: '7rem', r: -18 },
      { e: '🥕', x: '30%', y: '62%', s: '6rem', r: -30 },
      { e: '🌽', x: '74%', y: '28%', s: '5rem', r: 18 },
    ],
  },
  {
    eyebrow: 'Farm to Doorstep',
    titleBold: ['Daily Dairy &', 'Breakfast'],
    titleLight: 'Essentials',
    text: 'Farm-fresh milk, curd, paneer, eggs and bakery — stocked every morning at your nearest dark store.',
    href: '/browse/dairy-bread-eggs',
    bg: 'bg-[#EAF3F4]',
    bag: '#D5E3E6',
    items: [
      { e: '🥛', x: '46%', y: '4%', s: '7rem', r: -6 },
      { e: '🍞', x: '20%', y: '30%', s: '6rem', r: -12 },
      { e: '🧀', x: '66%', y: '18%', s: '5rem', r: 12 },
      { e: '🥚', x: '38%', y: '40%', s: '4rem' },
      { e: '🧈', x: '70%', y: '52%', s: '4.4rem', r: 8 },
      { e: '🥐', x: '10%', y: '60%', s: '5rem', r: -20 },
    ],
  },
  {
    eyebrow: 'Grow Your Own',
    titleBold: ['Seeds, Saplings', '& Farm'],
    titleLight: 'Supplies',
    text: 'Hybrid vegetable seeds, organic fertilizers, bio-pesticides and hand tools for balconies and farms alike.',
    href: '/browse/seeds-saplings',
    bg: 'bg-[#EEF3DF]',
    bag: '#CFC19C',
    items: [
      { e: '🌱', x: '46%', y: '2%', s: '7rem' },
      { e: '🪴', x: '18%', y: '24%', s: '6.4rem', r: -8 },
      { e: '🌻', x: '68%', y: '10%', s: '5.6rem', r: 14 },
      { e: '🧑‍🌾', x: '40%', y: '42%', s: '4.4rem' },
      { e: '🌾', x: '72%', y: '48%', s: '5rem', r: 20 },
      { e: '🍅', x: '10%', y: '62%', s: '4rem' },
    ],
  },
];

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [paused, next]);

  return (
    <section
      className="relative overflow-hidden rounded-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <div key={i} className={clsx('relative grid min-h-[340px] w-full shrink-0 items-center md:min-h-[400px] md:grid-cols-2', s.bg)} aria-hidden={i !== index}>
            <div className="relative z-10 px-7 py-10 md:px-14">
              <p className="mb-4 font-display text-xs font-bold uppercase tracking-wide text-ink">{s.eyebrow}</p>
              <h1 className="font-display text-[34px] leading-[1.15] text-ink md:text-[44px]">
                <span className="font-bold">{s.titleBold[0]}</span>
                <br />
                <span className="font-bold">{s.titleBold[1]}</span> <span className="font-normal">{s.titleLight}</span>
              </h1>
              <p className="mt-5 max-w-sm text-[13px] leading-6 text-ink-muted">{s.text}</p>
              <Link href={s.href} className="btn-primary mt-8 px-8 py-3 shadow-sm" tabIndex={i === index ? 0 : -1}>
                Shop Now
              </Link>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
              <div className="absolute bottom-0 right-[6%] h-[82%] w-[74%]">
                {/* tote bag */}
                <div className="absolute bottom-[-6%] left-[12%] h-[62%] w-[76%] rotate-[-4deg] rounded-t-[28px] rounded-b-md shadow-[inset_0_-20px_40px_rgba(0,0,0,0.08)]" style={{ backgroundColor: s.bag }} />
                <div className="absolute bottom-[50%] left-[22%] h-[40%] w-[26%] rotate-[-18deg] rounded-t-full border-[10px] border-b-0" style={{ borderColor: s.bag }} />
                <div className="absolute bottom-[52%] left-[56%] h-[36%] w-[24%] rotate-[14deg] rounded-t-full border-[10px] border-b-0" style={{ borderColor: s.bag }} />
                {s.items.map((it, k) => (
                  <span
                    key={k}
                    className={clsx('absolute select-none drop-shadow-md', k % 2 === 0 && i === index && 'animate-float')}
                    style={{ left: it.x, top: it.y, fontSize: it.s, transform: `rotate(${it.r ?? 0}deg)`, animationDelay: `${k * 0.4}s` }}
                  >
                    {it.e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 md:left-[70%]">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={clsx('rounded-full transition-all', i === index ? 'h-2 w-2 bg-ink ring-4 ring-ink/10' : 'h-1.5 w-1.5 bg-ink/30 hover:bg-ink/50')}
          />
        ))}
      </div>
    </section>
  );
}
