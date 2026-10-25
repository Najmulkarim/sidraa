'use client';

import { useState } from 'react';
import { saveStorefront } from '@/actions/admin-storefront';
import { FONT_CHOICES, INVOICE_TEMPLATES, type InvoiceTemplate, type Storefront } from '@/lib/storefront';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

/** A switch card, like the "Others settings" row: label on the right, on/off toggle on the left. */
function Toggle({ name, label, hint, on }: { name: string; label: string; hint?: string; on: boolean }) {
  const [v, setV] = useState(on);
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${v ? 'border-ok/40 bg-ok/5' : 'border-line'}`}>
      <input type="checkbox" name={name} checked={v} onChange={(e) => setV(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${v ? 'bg-[#16a34a]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${v ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0">
        <b className="block text-[13.5px]">{label}</b>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Mini drawing of each invoice design for the picker. */
function InvoiceThumb({ t }: { t: InvoiceTemplate }) {
  const line = 'block h-1 rounded-sm bg-gray-300';
  if (t === 'thermal') return <span className="mx-auto flex h-full w-10 flex-col gap-1 bg-white p-1.5 shadow-sm">{[8, 6, 9, 5, 9, 7].map((w, i) => <span key={i} className={line} style={{ width: `${w * 10}%` }} />)}</span>;
  return (
    <span className={`flex h-full w-full flex-col gap-1 bg-white p-2 shadow-sm ${t === 'compact' ? 'h-1/2' : ''}`}>
      <span className={`block h-3 rounded-sm ${t === 'modern' ? 'bg-brand' : t === 'minimal' ? 'bg-gray-100' : 'bg-gray-800'}`} />
      <span className="flex justify-between"><span className={`${line} w-1/3`} /><span className={`block h-2 w-1/4 rounded-sm ${t === 'modern' ? 'bg-brand/60' : 'bg-gray-500'}`} /></span>
      {[0, 1, 2].map((i) => <span key={i} className={`${line} ${t === 'minimal' ? 'bg-gray-200' : ''}`} />)}
      <span className={`${line} ml-auto w-1/3`} />
    </span>
  );
}

export function StorefrontSettingsForm({ sf, prefix, previewOrderId }: { sf: Storefront; prefix: string; previewOrderId: string | null }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveStorefront);
  const [tpl, setTpl] = useState<InvoiceTemplate>(sf.invoice.template);
  const [pre, setPre] = useState(prefix);

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="sticky top-14 z-10 flex items-center justify-between gap-3 rounded-xl border border-line bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-sm font-semibold">Storefront builder</p>
        <PendingButton pending={pending} className="btn btn-sm bg-[#16a34a] text-white hover:bg-[#15803d]">✓ Update</PendingButton>
      </div>

      <Card title="Header" hint="What shows in the top bar of every page.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Toggle name="hAnnouncement" label="Announcement strip" hint="The thin line above the header (text in Store tab)" on={sf.header.announcement} />
          <Toggle name="hMenu" label="Menu links" hint="Home, New arrivals, categories (computer)" on={sf.header.menu} />
          <Toggle name="hSearch" label="Search icon" on={sf.header.search} />
          <Toggle name="hTrack" label="Track order icon" on={sf.header.track} />
          <Toggle name="hCall" label="Call icon" hint="Needs a phone number in Store tab" on={sf.header.call} />
          <Toggle name="hSticky" label="Header stays on top while scrolling" on={sf.header.sticky} />
        </div>
      </Card>

      <Card title="Footer">
        <div className="grid gap-3 sm:grid-cols-3">
          <Toggle name="fNewsletter" label="Newsletter box" on={sf.footer.newsletter} />
          <Toggle name="fSocial" label="Social media icons" on={sf.footer.social} />
          <Toggle name="fContact" label="Contact column" on={sf.footer.contact} />
        </div>
      </Card>

      <Card title="Other settings">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle name="lBottomNav" label="Bottom navigation (mobile)" on={sf.layout.bottom_nav} />
          <Toggle name="lBackToTop" label="Back to top button" on={sf.layout.back_to_top} />
          <Toggle name="lWhatsapp" label="WhatsApp chat button" hint="Uses the shop phone number" on={sf.layout.whatsapp} />
          <Toggle name="lBreadcrumbs" label="Breadcrumbs" hint="Home › Category › Product" on={sf.layout.breadcrumbs} />
        </div>
      </Card>

      <Card title="Fonts & browser tab" hint="Leave fonts on “Theme default” to use the home theme’s pair.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="fontHeading" className="label">Heading font</label>
            <select id="fontHeading" name="fontHeading" defaultValue={sf.font_heading} className="input">
              {Object.entries(FONT_CHOICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fontBody" className="label">Text font</label>
            <select id="fontBody" name="fontBody" defaultValue={sf.font_body} className="input">
              {Object.entries(FONT_CHOICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="siteTitle" className="label">Name in the browser tab (optional)</label>
            <input id="siteTitle" name="siteTitle" defaultValue={sf.site_title} maxLength={70} placeholder="Store name is used when empty" className="input" />
          </div>
        </div>
      </Card>

      <Card title="Region & orders">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="field">
            <label htmlFor="country" className="label">Country</label>
            <input id="country" name="country" defaultValue={sf.country} maxLength={60} className="input" />
          </div>
          <div className="field">
            <span className="label">Currency</span>
            <p className="input flex items-center bg-soft text-muted">৳ BDT (Bangladeshi Taka)</p>
            <span className="hint">bKash, Nagad and the couriers work in taka.</span>
          </div>
          <div className="field">
            <label htmlFor="orderPrefix" className="label">Order number prefix</label>
            <input id="orderPrefix" name="orderPrefix" value={pre} onChange={(e) => setPre(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 10))} className="input font-mono" />
            <span className="hint">New orders look like <b className="font-mono">{(/^order$/i.test(pre) || !pre ? 'Order' : pre.toUpperCase())}0012</b> (the number keeps counting). Old orders keep their numbers.</span>
            <FieldError state={state} name="orderPrefix" />
          </div>
        </div>
      </Card>

      <Card title="Invoice" hint="Pick the design used when you print. You can still switch design on the print page.">
        <input type="hidden" name="invoiceTemplate" value={tpl} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(INVOICE_TEMPLATES) as InvoiceTemplate[]).map((t) => (
            <button key={t} type="button" onClick={() => setTpl(t)} aria-pressed={tpl === t} className={`flex flex-col overflow-hidden rounded-xl border text-left transition ${tpl === t ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-ink/40'}`}>
              <span className="flex h-28 items-start justify-center bg-soft p-3"><InvoiceThumb t={t} /></span>
              <span className="p-2.5">
                <b className="block text-[13px]">{INVOICE_TEMPLATES[t].name}{tpl === t ? ' ✓' : ''}</b>
                <span className="text-[11.5px] text-muted">{INVOICE_TEMPLATES[t].text}</span>
              </span>
            </button>
          ))}
        </div>
        {previewOrderId && <a href={`/admin/orders/${previewOrderId}/slip?t=${tpl}`} target="_blank" rel="noopener noreferrer" className="inline-block text-[13px] font-semibold text-brand underline">Preview with your latest order ↗</a>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle name="invShowLogo" label="Show logo" on={sf.invoice.show_logo} />
          <Toggle name="invShowSku" label="Show SKU of each item" on={sf.invoice.show_sku} />
          <div className="field">
            <label htmlFor="invTitle" className="label">Title</label>
            <input id="invTitle" name="invTitle" defaultValue={sf.invoice.title} maxLength={40} placeholder="Invoice" className="input" />
          </div>
          <div className="field">
            <label htmlFor="invFooter" className="label">Note at the bottom (optional)</label>
            <input id="invFooter" name="invFooter" defaultValue={sf.invoice.footer} maxLength={300} placeholder="Cash on delivery terms are used when empty" className="input" />
          </div>
        </div>
      </Card>

      <FormMessage state={state} />
      <PendingButton pending={pending} className="btn btn-primary">Save storefront settings</PendingButton>
    </form>
  );
}
