import HeroCarousel from '@/components/home/HeroCarousel';
import TopSaver from '@/components/home/TopSaver';
import PromoBanner from '@/components/home/PromoBanner';
import Features from '@/components/home/Features';
import PromoTiles from '@/components/home/PromoTiles';
import CategoryGrid from '@/components/home/CategoryGrid';
import ProductRail from '@/components/home/ProductRail';
import LiveStats from '@/components/home/LiveStats';

export default function HomePage() {
  return (
    <div className="container pt-6">
      <HeroCarousel />
      <TopSaver />
      <PromoBanner />
      <Features />
      <PromoTiles />
      <LiveStats />
      <CategoryGrid />
      <ProductRail title="Fresh Fruits & Vegetables" category="fruits-vegetables" subtitle="Sourced from farms at dawn" />
      <ProductRail title="Snacks & Munchies" category="snacks-munchies" />
      <ProductRail title="Brewery, Brews & Mixers" category="brews-mixers" subtitle="Kombucha, cold brew, 0.0% craft beer, tonics & home-brew kits" />
      <ProductRail title="Skin Care Picks" category="skin-care" />
      <ProductRail title="Men's Grooming" category="mens-grooming" />
      <ProductRail title="Seeds & Saplings" category="seeds-saplings" subtitle="Agri inputs for kitchen gardens and farms" />
    </div>
  );
}
