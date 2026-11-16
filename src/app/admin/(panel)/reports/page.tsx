import type { Metadata } from 'next';
import { AdvancedReport } from '@/components/admin/AdvancedReport';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('revenue'), searchParams]);
  return <AdvancedReport supabase={supabase} sp={sp} basePath="/admin/reports" />;
}
