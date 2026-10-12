import Link from 'next/link';

export default function PromoBanner() {
  const items = [
    { e: '🪮', x: '30%', y: '4%', s: '4.4rem', r: -30 },
    { e: '🧴', x: '8%', y: '38%', s: '4rem', r: 12 },
    { e: '🍯', x: '40%', y: '52%', s: '3.8rem' },
    { e: '💄', x: '56%', y: '14%', s: '3.4rem', r: 30 },
    { e: '🧖‍♀️', x: '20%', y: '62%', s: '3.2rem' },
    { e: '🌿', x: '82%', y: '8%', s: '5.2rem', r: 20 },
    { e: '🧺', x: '66%', y: '48%', s: '5rem', r: -8 },
    { e: '🫧', x: '48%', y: '0%', s: '2.6rem' },
  ];
  return (
    <section className="relative mt-14 grid min-h-[220px] overflow-hidden rounded-lg bg-cream md:grid-cols-2">
      <div className="relative z-10 px-8 py-10 md:px-24">
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide">All Tasted Products</p>
        <h2 className="font-display text-[26px] font-bold leading-tight md:text-3xl">Beauty &amp; Personal Care</h2>
        <p className="font-display text-[24px] font-normal md:text-[28px]">Up to 70% Off</p>
        <Link href="/browse/skin-care" className="btn mt-6 bg-[#4CAF73] px-9 py-3 text-white hover:bg-brand-600">Shop Now</Link>
      </div>
      <div className="pointer-events-none relative hidden md:block" aria-hidden>
        {items.map((it, i) => (
          <span key={i} className="absolute select-none drop-shadow" style={{ left: it.x, top: it.y, fontSize: it.s, transform: `rotate(${it.r ?? 0}deg)` }}>
            {it.e}
          </span>
        ))}
      </div>
    </section>
  );
}
