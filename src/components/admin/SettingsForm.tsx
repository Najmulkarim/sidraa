'use client';

import { saveSettings } from '@/actions/admin-settings';
import type { StoreSettings } from '@/lib/types';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

function Text({ name, label, defaultValue, state, hint, max, type = 'text' }: {
  name: string; label: string; defaultValue?: string | number | null; state: ReturnType<typeof useKeepValuesAction>['state']; hint?: string; max?: number; type?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} maxLength={max} className="input" />
      {hint && <p className="hint">{hint}</p>}
      <FieldError state={state} name={name} />
    </div>
  );
}

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveSettings);
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Brand</h2>
        <Text name="storeName" label="Store name" defaultValue={settings.store_name} state={state} max={80} />
        <Text name="tagline" label="Tagline" defaultValue={settings.tagline} state={state} max={120} />
        <div className="field">
          <label htmlFor="themePrimary" className="label">Main colour</label>
          <input id="themePrimary" name="themePrimary" type="color" defaultValue={settings.theme.primary ?? '#6b2d3c'} className="h-11 w-24 rounded-xl border border-line" />
          <FieldError state={state} name="themePrimary" />
        </div>
        <div className="field">
          <label htmlFor="themeAccent" className="label">Accent colour</label>
          <input id="themeAccent" name="themeAccent" type="color" defaultValue={settings.theme.accent ?? '#c9a227'} className="h-11 w-24 rounded-xl border border-line" />
          <FieldError state={state} name="themeAccent" />
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Contact (shown in the footer and on packing slips)</h2>
        <Text name="phone" label="Phone" defaultValue={settings.phone} state={state} max={30} />
        <Text name="email" label="Email" type="email" defaultValue={settings.email} state={state} max={120} />
        <div className="sm:col-span-2"><Text name="address" label="Address" defaultValue={settings.address} state={state} max={300} /></div>
        <Text name="facebook" label="Facebook page" defaultValue={settings.social.facebook} state={state} hint="Full https:// link" />
        <Text name="instagram" label="Instagram" defaultValue={settings.social.instagram} state={state} />
        <Text name="tiktok" label="TikTok" defaultValue={settings.social.tiktok} state={state} />
        <Text name="youtube" label="YouTube" defaultValue={settings.social.youtube} state={state} />
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">Orders</h2>
        <div className="field sm:col-span-3">
          <label htmlFor="codTerms" className="label">Cash-on-delivery terms</label>
          <textarea id="codTerms" name="codTerms" rows={3} maxLength={2000} defaultValue={settings.cod_terms} className="input" />
          <p className="hint">Shown on product pages, at checkout above the button, and on the confirmation.</p>
          <FieldError state={state} name="codTerms" />
        </div>
        <Text name="returnPolicyDays" label="Return window (days)" type="number" defaultValue={settings.return_policy_days} state={state} />
        <Text name="lowStockThreshold" label="Low-stock alert at" type="number" defaultValue={settings.low_stock_threshold} state={state} />
        <div className="sm:col-span-2"><Text name="announcement" label="Announcement bar (top of the shop)" defaultValue={settings.announcement} state={state} max={160} hint="Shown in the strip at the top of the shop. Leave empty for the automatic one (COD, free-delivery threshold, return window)." /></div>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="couponsEnabled" defaultChecked={settings.coupons_enabled} className="h-4 w-4 accent-[var(--brand)]" />
          Coupon field at checkout
        </label>
      </section>

      <div className="flex items-center gap-3">
        <PendingButton pending={pending}>Save settings</PendingButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
