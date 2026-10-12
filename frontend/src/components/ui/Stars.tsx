import { Star } from 'lucide-react';

export default function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= full ? 'fill-star text-star' : 'fill-zinc-200 text-zinc-200'} />
      ))}
    </div>
  );
}
