import Link from 'next/link';

const TILES = [
  { title: 'Fresh Fruites', off: '50% OFF', href: '/browse/fruits-vegetables', bg: 'bg-sand', items: ['🥕', '🧅', '🫑', '🥦', '🥬', '🧄'] },
  { title: 'Healthy Vegitable', off: '30% OFF', href: '/browse/fruits-vegetables', bg: 'bg-lime', items: ['🍊', '🍋', '🍇', '🥝', '🍎', '🍐'] },
  { title: 'Crunchy Snacks', off: '60% OFF', href: '/browse/snacks-munchies', bg: 'bg-sky', items: ['🥔', '🍟', '🥨', '🍿', '🥜', '🍪'] },
];

export default function PromoTiles() {
  return (
    <section className="mt-12 grid gap-5 md:grid-cols-3">
      {TILES.map((t) => (
        <Link key={t.title} href={t.href} className={`group relative h-[140px] overflow-hidden rounded-md ${t.bg} p-5 transition hover:shadow-lift`}>
          <h3 className="font-display text-xl font-medium">{t.title}</h3>
          <p className="mt-1 text-[11px] font-extrabold text-danger">{t.off}</p>
          <div className="absolute bottom-1 right-4 flex items-end" aria-hidden>
            {t.items.map((e, i) => (
              <span
                key={i}
                className="-ml-3 select-none drop-shadow transition-transform duration-300 group-hover:-translate-y-1"
                style={{ fontSize: i % 2 === 0 ? '2.8rem' : '2.3rem', transitionDelay: `${i * 30}ms` }}
              >
                {e}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </section>
  );
}
