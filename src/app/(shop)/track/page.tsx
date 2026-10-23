import type { Metadata } from 'next';
import { TrackForm } from '@/components/shop/TrackForm';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Check the status of your cash-on-delivery order.',
  alternates: { canonical: '/track' },
};

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <div className="container-page max-w-3xl py-12">
      <header className="mb-8 space-y-2">
        <p className="eyebrow">Order tracking</p>
        <h1 className="font-display text-4xl font-semibold">Where is my order?</h1>
        <p className="text-muted">Enter the reference from your confirmation and the last 4 digits of the phone number you used.</p>
      </header>
      <TrackForm defaultRef={typeof ref === 'string' ? ref.slice(0, 20) : ''} />
    </div>
  );
}
