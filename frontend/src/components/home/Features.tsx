import { BadgeCheck, Headset, ShieldCheck, Truck } from 'lucide-react';

const FEATURES = [
  { icon: Truck, title: 'Fastest Delivery', text: 'Delivery at your door step' },
  { icon: Headset, title: '24x7 Services', text: 'Reach us when needed' },
  { icon: BadgeCheck, title: 'Verified Brands', text: 'Guaranteed products' },
  { icon: ShieldCheck, title: '100% Assurance', text: 'We provide 100% assurance' },
];

export default function Features() {
  return (
    <section className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4">
      {FEATURES.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex flex-col items-center text-center">
          <span className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-mint text-brand-500 ring-8 ring-mint/50">
            <Icon size={24} strokeWidth={1.5} />
          </span>
          <h3 className="font-display text-[15px] font-semibold">{title}</h3>
          <p className="mt-1 text-[11px] text-ink-muted">{text}</p>
        </div>
      ))}
    </section>
  );
}
