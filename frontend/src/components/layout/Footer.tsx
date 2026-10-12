import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import Newsletter from './Newsletter';
import { SITE } from '@/lib/site';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Beverages',
    links: [
      { label: 'Tea', href: '/browse/tea-coffee' },
      { label: 'Coffee', href: '/browse/tea-coffee' },
      { label: 'Fruit Juices', href: '/browse/beverages' },
      { label: 'Energy Drinks', href: '/browse/beverages' },
      { label: 'Brews & Mixers', href: '/browse/brews-mixers' },
    ],
  },
  {
    title: 'Home Care',
    links: [
      { label: 'Detergent', href: '/browse/cleaning-household' },
      { label: 'Cleaners', href: '/browse/cleaning-household' },
      { label: 'Kitchenware', href: '/browse/home-kitchen' },
      { label: 'Pet Care', href: '/browse/pet-care' },
      { label: 'Farm & Garden', href: '/browse/seeds-saplings' },
    ],
  },
  {
    title: 'Personal Care',
    links: [
      { label: 'Skin Care', href: '/browse/skin-care' },
      { label: 'Hair Care', href: '/browse/hair-care' },
      { label: "Men's Grooming", href: '/browse/mens-grooming' },
      { label: 'Makeup', href: '/browse/makeup' },
      { label: 'Baby Care', href: '/browse/baby-care' },
    ],
  },
  {
    title: 'Get To Know Us',
    links: [
      { label: 'About Us', href: '/' },
      { label: 'My Orders', href: '/orders' },
      { label: 'Green Initiatives', href: '/' },
      { label: 'Privacy Policy', href: '/' },
      { label: 'Store Dashboard', href: '/admin/dashboard' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16">
      <Newsletter />
      <div className="bg-[#FAFCFA]">
        <div className="container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg text-white">🛒</span>
              <span className="font-display text-xl font-extrabold">Quick<span className="text-brand-500">Cart</span></span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-muted">
              Groceries, snacks, brews, beauty and farm supplies from a dark store near you — packed in 2 minutes, delivered in 10.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              <li className="flex items-center gap-2"><MapPin size={14} className="text-brand-500" /> 80 Feet Rd, Koramangala, Bengaluru 560034</li>
              <li><a href={SITE.phoneHref} className="flex items-center gap-2 hover:text-brand-700"><Phone size={14} className="text-brand-500" /> {SITE.phoneDisplay}</a></li>
              <li><a href={SITE.emailHref} className="flex items-center gap-2 break-all hover:text-brand-700"><Mail size={14} className="text-brand-500" /> {SITE.email}</a></li>
              <li><a href={SITE.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white hover:bg-brand-600">💬 WhatsApp us</a></li>
            </ul>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 font-display text-sm font-bold">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-ink-muted hover:text-brand-700">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-ink-muted md:flex-row">
            <p>© {new Date().getFullYear()} QuickCart Technologies. All rights reserved.</p>
            <div className="flex items-center gap-3">
              {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-brand-700"><Icon size={14} /></span>
              ))}
            </div>
            <p>Payments secured by Stripe · UPI · Cards · COD</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
