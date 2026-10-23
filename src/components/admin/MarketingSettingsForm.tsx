'use client';

import { saveMarketingSettings } from '@/actions/admin-settings';
import { CopyField, SecretInput } from './SecretInput';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export type MarketingView = { fb_pixel_id: string | null; capi_enabled: boolean; capi_token: string | null; capi_test_code: string | null; graph_version: string };

export function MarketingSettingsForm({ settings: m, siteUrl }: { settings: MarketingView; siteUrl: string }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveMarketingSettings);
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Meta Pixel (browser)</h2>
          <p className="text-sm text-muted">Sends PageView, ViewContent, AddToCart, InitiateCheckout and Purchase from the shop. Leave empty to turn the Pixel off.</p>
        </div>
        <div className="field">
          <label htmlFor="fbPixelId" className="label">Pixel ID</label>
          <input id="fbPixelId" name="fbPixelId" inputMode="numeric" defaultValue={m.fb_pixel_id ?? ''} placeholder="e.g. 123456789012345" className="input font-mono" />
          <p className="hint">Events Manager → Data sources → your dataset → Dataset ID.</p>
          <FieldError state={state} name="fbPixelId" />
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Conversions API (server-side tracking)</h2>
          <p className="text-sm text-muted">
            Sends every Purchase from the server too — it still counts when an ad blocker or iOS stops the Pixel. Both use the order reference as the event ID, so Meta counts each order once. Phone, name and district are SHA-256 hashed before they leave the server.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="capiEnabled" defaultChecked={m.capi_enabled} className="h-4 w-4 accent-[var(--brand)]" />
          Send Purchase events with the Conversions API
        </label>
        <SecretInput name="capiToken" label="Access token" saved={m.capi_token} state={state} hint="Events Manager → Settings → Conversions API → Generate access token." />
        <div className="field">
          <label htmlFor="capiTestCode" className="label">Test event code (optional)</label>
          <input id="capiTestCode" name="capiTestCode" defaultValue={m.capi_test_code ?? ''} maxLength={40} placeholder="TEST12345" className="input font-mono" />
          <p className="hint">Events then appear under Test events only. Clear it when you go live.</p>
        </div>
        <div className="field">
          <label htmlFor="graphVersion" className="label">Graph API version</label>
          <input id="graphVersion" name="graphVersion" defaultValue={m.graph_version} className="input font-mono" />
          <FieldError state={state} name="graphVersion" />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Catalog for Facebook &amp; Instagram shops</h2>
        <p className="text-sm text-muted">In Commerce Manager → Catalog → Data sources → Data feed, add this URL as a scheduled feed (daily). Product IDs match the Pixel events.</p>
        <CopyField label="Catalog feed URL" value={`${siteUrl}/feeds/facebook-catalog.csv`} />
      </section>

      <div className="flex items-center gap-3">
        <PendingButton pending={pending}>Save Facebook settings</PendingButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
