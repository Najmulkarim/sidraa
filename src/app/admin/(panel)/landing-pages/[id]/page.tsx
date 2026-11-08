import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LandingForm } from '@/components/admin/LandingForm';
import { loadLandingFormData } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import { LANDING_SELECT, toLandingPage } from '@/lib/landing';

export const metadata: Metadata = { title: 'Edit landing page' };

export default async function EditLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase }, { id }] = await Promise.all([requirePermission('catalog'), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data }, form] = await Promise.all([
    supabase.from('landing_pages').select(LANDING_SELECT).eq('id', id).maybeSingle(),
    loadLandingFormData(supabase),
  ]);
  if (!data) notFound();
  const page = toLandingPage(data as Record<string, unknown>);
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/landing-pages" className="text-sm text-muted hover:text-ink">← Landing pages</Link>
        <h1 className="text-2xl font-bold tracking-tight">/offer/{page.slug}</h1>
      </header>
      <LandingForm key={page.updated_at} page={page} {...form} />
    </div>
  );
}
