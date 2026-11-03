import { formatTaka } from './format';
import type { StoreSettings } from './types';

/**
 * The footer's Customer care pages (/info/…). Staff can rewrite each one in
 * Admin → Pages; until they do, the starter text below is shown. Text uses
 * the same light marks as product descriptions ("## " heading, "- " list,
 * **bold**).
 */
export const INFO_PAGES = {
  delivery: { label: 'Delivery & COD', title: 'Delivery & cash on delivery', description: 'Delivery areas, charges and how cash on delivery works.' },
  returns: { label: 'Returns & exchange', title: 'Returns & exchange', description: 'How to return or exchange an item.' },
  privacy: { label: 'Privacy policy', title: 'Privacy policy', description: 'What we collect and why.' },
  terms: { label: 'Terms & conditions', title: 'Terms & conditions', description: 'Terms of sale.' },
} as const;
export type InfoPageKey = keyof typeof INFO_PAGES;
export const INFO_PAGE_KEYS = Object.keys(INFO_PAGES) as InfoPageKey[];
export const isInfoPage = (v: unknown): v is InfoPageKey => typeof v === 'string' && v in INFO_PAGES;

export function defaultPageText(key: InfoPageKey, s: Pick<StoreSettings, 'cod_terms' | 'return_policy_days'>): string {
  const days = `${s.return_policy_days} day${s.return_policy_days === 1 ? '' : 's'}`;
  switch (key) {
    case 'delivery':
      return [
        '## How cash on delivery works',
        s.cod_terms,
        '',
        '1. Place your order — no payment or account needed.',
        '2. We call to confirm the order and your address.',
        '3. The rider brings the parcel; you check it and pay the rider in cash.',
      ].join('\n');
    case 'returns':
      return [
        `You can check your parcel in front of the rider before paying. If something is wrong — size, colour or a fault — you may refuse it then, or contact us within **${days}** of delivery.`,
        '',
        'Items must be unused, unwashed and with tags attached. Have your order reference ready when you contact us.',
      ].join('\n');
    case 'privacy':
      return [
        'To deliver your order we collect your name, mobile number, address and any note you add. We do not ask for card details or create customer accounts.',
        '',
        'Your details are used only to confirm and deliver your order and are shared only with the delivery service that carries it.',
        '',
        'Order tracking shows status and items only, never your address or full phone number.',
      ].join('\n');
    case 'terms':
      return [
        'Prices are in Bangladeshi Taka and include VAT where applicable. The price you pay is the one shown at checkout, confirmed by our server when you place the order.',
        '',
        'Orders are confirmed by phone. We may cancel an order we cannot confirm or if an item becomes unavailable; you will not be charged.',
        '',
        `Returns are accepted within ${days} of delivery — see our returns page for details.`,
      ].join('\n');
  }
}

/** One line per delivery area, always current (shown under the delivery page's own text). */
export function zoneLine(z: { name: string; charge: number | string; eta_text: string | null; free_over: number | string | null }): string {
  return `**${z.name}**: ${formatTaka(z.charge)}${z.eta_text ? `, usually ${z.eta_text}` : ''}${z.free_over !== null ? ` — free on orders of ${formatTaka(z.free_over)} or more` : ''}`;
}
