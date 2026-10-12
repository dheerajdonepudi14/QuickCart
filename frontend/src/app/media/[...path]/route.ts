import { NextResponse } from 'next/server';

/**
 * Same-origin proxy for photos stored on the backend's local disk (/uploads/**). Lets next/image optimise
 * them (AVIF/WebP, resizing) even inside Docker, where "localhost:8080" isn't reachable from the frontend
 * container. INTERNAL_API_URL is the backend address as seen from the Next.js server.
 */
export const dynamic = 'force-dynamic';

const INTERNAL = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const safe = params.path.filter((p) => p && p !== '..' && p !== '.').map(encodeURIComponent).join('/');
  try {
    const upstream = await fetch(`${INTERNAL}/uploads/${safe}`, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) return new NextResponse('Not found', { status: upstream.status === 200 ? 404 : upstream.status });
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Image backend unreachable', { status: 502 });
  }
}
