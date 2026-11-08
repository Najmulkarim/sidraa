import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingForm } from '@/components/admin/LandingForm';
import { loadLandingFormData } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'New landing page' };

export default async function NewLandingPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const data = await loadLandingFormData(supabase);
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/landing-pages" className="text-sm text-muted hover:text-ink">← Landing pages</Link>
        <h1 className="text-2xl font-bold tracking-tight">New landing page</h1>
      </header>
      {/* ?template=…: started from the Designs list; the plain New button = manual. */}
      <LandingForm {...data} startTemplate={sp.template === 'classic' || sp.template === 'story' ? sp.template : 'showcase'} source={sp.template === 'classic' || sp.template === 'story' || sp.template === 'showcase' ? 'design' : 'manual'} />
    </div>
  );
}
