import Image from 'next/image';
import Link from 'next/link';

const TILES = [
  { title: 'Fresh Fruits', off: '50% OFF', href: '/browse/fruits-vegetables', bg: 'bg-sand', image: '/promo/tile-fruits.jpg' },
  { title: 'Healthy Vegetables', off: '30% OFF', href: '/browse/fruits-vegetables', bg: 'bg-lime', image: '/promo/tile-vegetables.jpg' },
  { title: 'Crunchy Snacks', off: '60% OFF', href: '/browse/snacks-munchies', bg: 'bg-sky', image: '/promo/tile-snacks.jpg' },
];

/** Soft side fades hide the neighbouring crates that sit at the edges of each crop. */
const EDGE_FADE = 'linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)';

export default function PromoTiles() {
  return (
    <section className="mt-12 grid gap-5 md:grid-cols-3">
      {TILES.map((t) => (
        <Link key={t.title} href={t.href} className={`group relative h-[140px] overflow-hidden rounded-md ${t.bg} p-5 transition hover:shadow-lift`}>
          <h3 className="relative z-10 font-display text-xl font-medium">{t.title}</h3>
          <p className="relative z-10 mt-1 text-[11px] font-extrabold text-danger">{t.off}</p>
          {/* multiply drops the photo's light backdrop into the tile colour, leaving just the crate */}
          <div className="absolute -bottom-1 right-2 h-[132px] w-[136px] transition-transform duration-300 group-hover:-translate-y-1" aria-hidden>
            <Image
              src={t.image}
              alt=""
              fill
              sizes="136px"
              className="object-contain object-bottom mix-blend-multiply"
              style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
            />
          </div>
        </Link>
      ))}
    </section>
  );
}
