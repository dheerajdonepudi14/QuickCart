import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center py-24 text-center">
      <div className="mb-4 text-7xl">🥕</div>
      <h1 className="font-display text-3xl font-bold">This aisle doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-ink-muted">The page you&apos;re looking for was moved or never stocked.</p>
      <Link href="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
