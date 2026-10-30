import type { Metadata } from 'next';
import { ImportFromBrowser } from '@/components/admin/ImportFromBrowser';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'Import a product' };

/** Opened by the "Send to Sidraa" bookmark. */
export default async function ImportPage() {
  await requirePermission('catalog');
  return <ImportFromBrowser />;
}
