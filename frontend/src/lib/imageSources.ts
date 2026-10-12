/**
 * Free, key-less image sources for product photos:
 *  - Wikimedia Commons  (commons.wikimedia.org API, CORS via origin=*)
 *  - Wikipedia          (page lead images)
 *  - Open Food Facts    (packaged-food pack shots; search is rate limited to ~10 req/min)
 * All returned URLs are public CDN links that keep working after you deploy.
 */
export interface ImageCandidate {
  url: string;
  thumb: string;
  source: 'Commons' | 'Wikipedia' | 'Open Food Facts';
  title: string;
}

const NOISE = /\b(fresh|premium|organic|hybrid|pack|combo|value|family|classic|original|regular|special|super|extra|daily|new|best|natural|pure|farm|local|desi|imported|small|medium|large|big|mini|jumbo|of|with|and|the|for)\b/gi;

/** "Fresh Tomato (Hybrid) 500 g" -> "tomato" */
export function cleanQuery(title: string, brand?: string | null): string {
  let q = title
    .replace(/\(.*?\)/g, ' ')
    .replace(/\d+(\.\d+)?\s*(kg|g|gm|ml|l|ltr|pcs|pc|x|pack|n|units?)\b/gi, ' ')
    .replace(/[^\p{L}\s&-]/gu, ' ');
  if (brand) q = q.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), ' ');
  q = q.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
  return q || title;
}

interface CommonsPage { title: string; imageinfo?: { thumburl?: string; url?: string; mime?: string }[] }

export async function searchCommons(query: string, limit = 8, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6' +
    `&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=480`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage & { index?: number }> } };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || !info.mime?.startsWith('image/') || info.mime === 'image/svg+xml') return [];
      return [{ url: info.thumburl, thumb: info.thumburl, source: 'Commons' as const, title: p.title.replace(/^File:/, '') }];
    });
}

interface WikiPage { title: string; index?: number; thumbnail?: { source: string } }

export async function searchWikipedia(query: string, limit = 6, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&prop=pageimages' +
    `&piprop=thumbnail&pithumbsize=480&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  return Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => (p.thumbnail?.source && !p.thumbnail.source.endsWith('.svg.png')
      ? [{ url: p.thumbnail.source, thumb: p.thumbnail.source, source: 'Wikipedia' as const, title: p.title }]
      : []));
}

interface OffProduct { product_name?: string; brands?: string; image_front_url?: string; image_front_small_url?: string }

export async function searchOpenFoodFacts(query: string, limit = 8, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=${limit}&fields=product_name,brands,image_front_url,image_front_small_url&search_terms=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? []).flatMap((p) =>
    p.image_front_url
      ? [{ url: p.image_front_url, thumb: p.image_front_small_url ?? p.image_front_url, source: 'Open Food Facts' as const, title: [p.brands, p.product_name].filter(Boolean).join(' · ') }]
      : []);
}

/** Categories whose items are generic (a tomato is a tomato) — Commons photos match best. */
const GENERIC = new Set(['fruits-vegetables', 'meat-seafood', 'seeds-saplings', 'fertilizers-plant-care', 'farm-garden-tools', 'home-kitchen', 'pet-care', 'dairy-bread-eggs']);

/** Best single guess for bulk auto-matching (Commons first, Wikipedia fallback). */
export async function bestMatch(title: string, brand: string | null | undefined, categorySlug: string, signal?: AbortSignal): Promise<ImageCandidate | null> {
  const generic = cleanQuery(title, brand);
  const queries = GENERIC.has(categorySlug) ? [generic] : [`${brand ?? ''} ${generic}`.trim(), generic];
  for (const q of queries) {
    try {
      const commons = await searchCommons(q, 3, signal);
      if (commons[0]) return commons[0];
      const wiki = await searchWikipedia(q, 3, signal);
      if (wiki[0]) return wiki[0];
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
  }
  return null;
}
