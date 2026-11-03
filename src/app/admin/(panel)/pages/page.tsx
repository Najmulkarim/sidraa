import type { Metadata } from 'next';
import { InfoPageForm } from '@/components/admin/InfoPageForm';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { defaultPageText, INFO_PAGE_KEYS, INFO_PAGES } from '@/lib/info-pages';
import { parseStorefront } from '@/lib/storefront';

export const metadata: Metadata = { title: 'Pages' };

/** The footer's Customer care pages: Delivery & COD, Returns, Privacy, Terms. */
export default async function PagesAdminPage() {
  const [{ supabase }, settings] = await Promise.all([requirePermission('store_settings'), getSettings()]);
  // Read the live row, not the cached copy, so a save shows at once.
  const { data } = await supabase.from('store_settings').select('storefront').eq('id', 1).maybeSingle<{ storefront: unknown }>();
  const { pages } = parseStorefront(data?.storefront ?? settings.storefront);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pages</h1>
        <p className="mt-1 text-sm text-muted">The pages linked under <b>Customer care</b> in the footer. Change the heading or text and press Save.</p>
      </div>
      {INFO_PAGE_KEYS.map((key) => {
        const own = pages[key];
        return (
          <InfoPageForm
            key={key}
            page={key}
            label={INFO_PAGES[key].label}
            title={own.title}
            defaultTitle={INFO_PAGES[key].title}
            body={own.body || defaultPageText(key, settings)}
            custom={!!own.body}
            note={key === 'delivery' ? 'The delivery charges list is added below your text by itself, from Settings → Delivery.' : undefined}
          />
        );
      })}
    </div>
  );
}
