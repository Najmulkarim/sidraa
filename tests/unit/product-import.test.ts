import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from '@/lib/import/address';
import { parseProductPage, plainText } from '@/lib/import/parse';

const URL_BD = 'https://shop.example.com.bd/p/1';
const URL_US = 'https://shop.example.com/p/1';

describe('product import', () => {
  it('reads a schema.org product, and keeps a price only in Taka', () => {
    const ld = (currency: string) => `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Product', name: 'Red &amp; Bag', description: '<p>Soft</p>', image: ['/a.jpg', { url: 'https://cdn.example.com/b.jpg' }], offers: { price: '950', priceCurrency: currency } }] })}</script>`;
    const bdt = parseProductPage(ld('BDT'), URL_US);
    expect(bdt).toMatchObject({ name: 'Red & Bag', description: 'Soft', price: 950 });
    expect(bdt?.images).toEqual(['https://shop.example.com/a.jpg', 'https://cdn.example.com/b.jpg']);
    expect(parseProductPage(ld('USD'), URL_US)?.price).toBeNull();
  });

  it('falls back to social tags, and treats no currency as Taka only on a .bd site', () => {
    const html = '<meta property="og:title" content="Blue Watch"><meta property="og:image" content="/w.jpg"><meta property="product:price:amount" content="500">';
    expect(parseProductPage(html, URL_US)).toMatchObject({ name: 'Blue Watch', price: null, images: ['https://shop.example.com/w.jpg'] });
    expect(parseProductPage(html, URL_BD)?.price).toBe(500);
  });

  it('reads variation data, fits the limits and drops repeats', () => {
    const data = { props: { p: {
      title: 'Watch', images: ['https://x.com/1.jpg'], regular_price: 99,
      variation_groups: [{ key: 'Color', options: [{ name: 'Black', image: 'https://x.com/b.jpg' }, { name: 'A very long colour name that goes well past thirty', image: null }] }],
      variation_items: [{ variant: { Color: 'Black' }, regular_price: 99 }, { variant: { Color: 'Black' }, regular_price: 99 }, { variant: { Color: 'A very long colour name that goes well past thirty' }, regular_price: 120 }],
    } } };
    const p = parseProductPage(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`, URL_BD);
    expect(p?.colorLabel).toBe('Color');
    expect(p?.variants).toHaveLength(2);
    expect(p?.variants[0]).toMatchObject({ color: 'Black', price: 99, image: 'https://x.com/b.jpg' });
    expect(p?.variants[1]?.color.length).toBe(30);
    expect(p?.images).toEqual(['https://x.com/1.jpg', 'https://x.com/b.jpg']);
  });

  it('reads a Shopify product without taking its price as Taka', () => {
    const body = { product: { title: 'Tee', body_html: '<b>Nice</b>', images: [{ id: 7, src: 'https://c.com/t.jpg' }], options: [{ name: 'Size' }], variants: [{ option1: 'M', price: '20.00', image_id: 7 }] } };
    const p = parseProductPage('', URL_US, body);
    expect(p).toMatchObject({ name: 'Tee', description: 'Nice', price: null, colorLabel: 'Size' });
    expect(p?.variants[0]).toMatchObject({ color: 'M', price: null, image: 'https://c.com/t.jpg' });
  });

  it('finds nothing on a page with no product, and ignores non-web photo links', () => {
    expect(parseProductPage('<p>hello</p>', URL_US)).toBeNull();
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', image: 'javascript:alert(1)' })}</script>`;
    expect(parseProductPage(html, URL_US)?.images).toEqual([]);
  });

  it('strips scripts and tags from text', () => {
    expect(plainText('<script>bad()</script><p>One</p><p>Two &amp; three</p>')).toBe('One\nTwo & three');
  });

  it('never fetches private or local addresses', () => {
    for (const a of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1', 'nonsense']) expect(isBlockedAddress(a), a).toBe(true);
    for (const a of ['8.8.8.8', '104.16.0.1', '2606:4700::1111']) expect(isBlockedAddress(a), a).toBe(false);
  });
});
