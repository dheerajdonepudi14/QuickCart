import Image from 'next/image';
import Link from 'next/link';

export default function PromoBanner() {
  return (
    <section className="relative mt-14 grid min-h-[220px] overflow-hidden rounded-lg bg-cream md:grid-cols-2">
      <div className="relative z-10 px-8 py-10 md:px-24">
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-wide">All Tasted Products</p>
        <h2 className="font-display text-[26px] font-bold leading-tight md:text-3xl">Beauty &amp; Personal Care</h2>
        <p className="font-display text-[24px] font-normal md:text-[28px]">Up to 70% Off</p>
        <Link href="/browse/skin-care" className="btn mt-6 bg-[#DC2626] px-9 py-3 text-white hover:bg-brand-600">Shop Now</Link>
      </div>
      <div className="pointer-events-none relative hidden md:block" aria-hidden>
        {/* the mask fades the photo's shadowed left edge into the banner colour */}
        <Image
          src="/promo/beauty-care.jpg"
          alt=""
          fill
          sizes="(min-width: 1280px) 640px, 50vw"
          className="object-cover object-[center_60%]"
          style={{ maskImage: 'linear-gradient(to right, transparent, #000 35%)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 35%)' }}
        />
      </div>
    </section>
  );
}
