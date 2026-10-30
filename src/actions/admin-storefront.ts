'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { IMAGE_BUCKET } from '@/lib/env';
import { parseStorefront, storefrontSchema, parseLiveChat } from '@/lib/storefront';
import type { ActionState } from '@/lib/types';

const flag = (fd: FormData, name: string) => fd.get(name) === 'on';
const text = (fd: FormData, name: string) => String(fd.get(name) ?? '').trim();

function refresh() {
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  revalidatePath('/admin/settings');
}

/** Settings → Storefront: switches, fonts, title, country, order prefix and invoice. */
export async function saveStorefront(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const { data: cur } = await supabase.from('store_settings').select('storefront').eq('id', 1).single<{ storefront: unknown }>();
  const old = parseStorefront(cur?.storefront);

  const prefixRaw = text(fd, 'orderPrefix');
  const prefix = /^order$/i.test(prefixRaw) || prefixRaw === '' ? 'Order' : prefixRaw.toUpperCase();
  if (prefix !== 'Order' && !/^[A-Z]{2,10}$/.test(prefix)) {
    return { ok: false, message: 'Order prefix: 2 to 10 letters (A–Z), e.g. SDR — or Order.', fieldErrors: { orderPrefix: '2–10 letters' } };
  }

  const chatRaw = text(fd, 'liveChat');
  const liveChat = chatRaw ? parseLiveChat(chatRaw) : null;
  if (chatRaw && !liveChat) return { ok: false, message: 'Live chat: paste the tawk.to chat link or widget code.', fieldErrors: { liveChat: 'Paste the tawk.to chat link or widget code.' } };

  const next = storefrontSchema.safeParse({
    header: { announcement: flag(fd, 'hAnnouncement'), search: flag(fd, 'hSearch'), track: flag(fd, 'hTrack'), call: flag(fd, 'hCall'), menu: flag(fd, 'hMenu'), sticky: flag(fd, 'hSticky') },
    footer: { newsletter: flag(fd, 'fNewsletter'), social: flag(fd, 'fSocial'), contact: flag(fd, 'fContact') },
    layout: { bottom_nav: flag(fd, 'lBottomNav'), back_to_top: flag(fd, 'lBackToTop'), whatsapp: flag(fd, 'lWhatsapp'), breadcrumbs: flag(fd, 'lBreadcrumbs') },
    font_heading: text(fd, 'fontHeading'),
    font_body: text(fd, 'fontBody'),
    favicon: old.favicon,
    og_image: old.og_image,
    site_title: text(fd, 'siteTitle').slice(0, 70),
    country: text(fd, 'country').slice(0, 60) || 'Bangladesh',
    live_chat: liveChat,
    invoice: {
      template: text(fd, 'invoiceTemplate'),
      show_logo: flag(fd, 'invShowLogo'),
      show_sku: flag(fd, 'invShowSku'),
      title: text(fd, 'invTitle').slice(0, 40) || 'Invoice',
      footer: text(fd, 'invFooter').slice(0, 300),
    },
  });
  if (!next.success) return { ok: false, message: 'Please check the fields.' };

  const { error } = await supabase.from('store_settings').update({ storefront: next.data, order_number_prefix: prefix }).eq('id', 1);
  if (error) {
    console.error('[admin] storefront', error);
    return { ok: false, message: 'Could not save. Run the latest database update (0023) in Supabase, then try again.' };
  }
  refresh();
  return { ok: true, message: 'Storefront settings saved.' };
}

const BRAND_FILE = /^brand\/[0-9a-f-]{36}\.(png|jpg|webp|avif|ico)$/;

/** Favicon or share image (uploaded to brand/… by the browser first); null removes it. */
export async function setBrandImage(kind: 'favicon' | 'og_image', path: string | null): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  if (kind !== 'favicon' && kind !== 'og_image') return { ok: false, message: 'Unknown image.' };
  if (path !== null && !BRAND_FILE.test(path)) return { ok: false, message: 'Invalid file.' };
  const { data: cur } = await supabase.from('store_settings').select('storefront').eq('id', 1).single<{ storefront: unknown }>();
  const sf = parseStorefront(cur?.storefront);
  const before = sf[kind];
  const { error } = await supabase.from('store_settings').update({ storefront: { ...sf, [kind]: path } }).eq('id', 1);
  if (error) return { ok: false, message: 'Could not save. Run the latest database update (0023) in Supabase.' };
  if (before && before !== path) await supabase.storage.from(IMAGE_BUCKET).remove([before]);
  refresh();
  const name = kind === 'favicon' ? 'Favicon' : 'Share image';
  return { ok: true, message: path ? `${name} updated.` : `${name} removed.` };
}
