import {
  Apple, Baby, Bath, Beef, Beer, Candy, Carrot, Coffee, CookingPot, Croissant, CupSoda, Dog, FlaskConical,
  HeartPulse, IceCreamCone, Milk, Package, Popcorn, Scissors, Sparkles, UtensilsCrossed, Sprout, SprayCan, Tractor,
  Wheat, Brush, Smile, type LucideIcon,
} from 'lucide-react';

/** Green line icons for the category tiles — matches the outline style of the mockups. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'fruits-vegetables': Carrot,
  'dairy-bread-eggs': Milk,
  'atta-rice-dal': Wheat,
  'masala-oils-ghee': CookingPot,
  'meat-seafood': Beef,
  'breakfast-instant': Croissant,
  'frozen-ice-cream': IceCreamCone,
  'snacks-munchies': Popcorn,
  'sweets-chocolates': Candy,
  beverages: CupSoda,
  'tea-coffee': Coffee,
  'brews-mixers': Beer,
  'skin-care': Sparkles,
  'hair-care': Brush,
  'mens-grooming': Scissors,
  'bath-body': Bath,
  'oral-care': Smile,
  makeup: Sparkles,
  'baby-care': Baby,
  'health-wellness': HeartPulse,
  'cleaning-household': SprayCan,
  'home-kitchen': UtensilsCrossed,
  'pet-care': Dog,
  'seeds-saplings': Sprout,
  'fertilizers-plant-care': FlaskConical,
  'farm-garden-tools': Tractor,
  fruits: Apple,
};

export const categoryIcon = (slug: string): LucideIcon => CATEGORY_ICONS[slug] ?? Package;
