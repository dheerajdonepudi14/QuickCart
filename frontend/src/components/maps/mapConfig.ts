/**
 * Free map stack: OpenStreetMap tiles + OSRM routing (no API keys). Address autocomplete / geocoding goes
 * through the backend (/api/v1/geo/*), which uses Google Places when GOOGLE_MAPS_API_KEY is set, else OSM.
 * To use a hosted tile style (MapTiler, Stadia, Thunderforest…) set NEXT_PUBLIC_MAP_TILE_URL at build time,
 * e.g. https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=YOUR_KEY
 */
export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const TILE_MAX_ZOOM = process.env.NEXT_PUBLIC_MAP_TILE_URL ? 20 : 19;

export const OSRM_URL = process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';

export type LatLng = [number, number];

export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<{ points: LatLng[]; distanceKm: number; minutes: number } | null> {
  const url = `${OSRM_URL}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      distanceKm: r.distance / 1000,
      minutes: Math.max(1, Math.round(r.duration / 60)),
    };
  } catch {
    return null;
  }
}

export const googleMapsDirections = (from: LatLng, to: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=driving`;

export const googleMapsPin = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p[0]},${p[1]}`;
