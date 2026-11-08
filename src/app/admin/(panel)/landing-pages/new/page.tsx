import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingForm } from '@/components/admin/LandingForm';
import { loadLandingFormData } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'New landing page' };

export default async function NewLandingPage() {
  const { supabase } = await requirePermission('catalog');
  const data = await loadLandingFormData(supabase);
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/landing-pages" className="text-sm text-muted hover:text-ink">← Landing pages</Link>
        <h1 className="text-2xl font-bold tracking-tight">New landing page</h1>
      </header>
      <LandingForm {...data} />
    </div>
  );
}
