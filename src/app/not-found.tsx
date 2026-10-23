import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-4xl font-semibold">We could not find that page</h1>
      <p className="text-muted">It may have moved, or the product is no longer available.</p>
      <div className="flex gap-3">
        <Link href="/" className="btn btn-primary">Home</Link>
        <Link href="/products" className="btn btn-outline">Shop all</Link>
      </div>
    </main>
  );
}
