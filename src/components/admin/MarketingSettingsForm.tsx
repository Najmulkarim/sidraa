'use client';

import { useState, useTransition } from 'react';
import { saveMarketingSettings, testFacebookConnection } from '@/actions/admin-settings';
import type { ActionState } from '@/lib/types';
import { notify } from './Toaster';
import { CopyField, SecretInput } from './SecretInput';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export type MarketingView = { fb_pixel_id: string | null; capi_enabled: boolean; capi_token: string | null; capi_test_code: string | null; graph_version: string; updated_at?: string | null };

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-line">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`flex items-center gap-1.5 font-mono text-[13px] font-semibold ${ok ? 'text-ok' : 'text-muted'}`}>{ok ? '✓' : '—'} {value}</span>
    </div>
  );
}

export function MarketingSettingsForm({ settings: m, siteUrl }: { settings: MarketingView; siteUrl: string }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveMarketingSettings);
  const [test, setTest] = useState<ActionState | null>(null);
  const [testing, start] = useTransition();
  // The boxes start from what is saved and keep what was typed.
  const [pixel, setPixel] = useState(m.fb_pixel_id ?? '');
  const [code, setCode] = useState(m.capi_test_code ?? '');
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {/* What the database holds right now (refreshed after every save). */}
      <section className={`space-y-2 rounded-xl border p-4 ${m.fb_pixel_id ? 'border-ok/40 bg-ok/5' : 'border-warn/40 bg-warn/5'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{m.fb_pixel_id ? 'Saved now ✓' : 'Nothing saved yet'}</h2>
          {m.updated_at && <span className="text-[12px] text-muted">Last saved {new Date(m.updated_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Row label="Pixel (Dataset) ID" value={m.fb_pixel_id ?? 'not set'} ok={!!m.fb_pixel_id} />
          <Row label="Access token" value={m.capi_token ? `saved ${m.capi_token}` : 'not set'} ok={!!m.capi_token} />
          <Row label="Test event code" value={m.capi_test_code ?? 'none'} ok={!!m.capi_test_code} />
          <Row label="Conversions API" value={m.capi_enabled ? 'ON' : 'OFF'} ok={m.capi_enabled} />
        </div>
      </section>
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Meta Pixel (browser)</h2>
          <p className="text-sm text-muted">Sends PageView, ViewContent, AddToCart, InitiateCheckout and Purchase from the shop. Leave empty to turn the Pixel off.</p>
        </div>
        <div className="field">
          <label htmlFor="fbPixelId" className="label">Pixel ID</label>
          <input id="fbPixelId" name="fbPixelId" inputMode="numeric" value={pixel} onChange={(e) => setPixel(e.target.value)} placeholder="e.g. 123456789012345" className="input font-mono" />
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
        <SecretInput name="capiToken" label="Access token" saved={m.capi_token} state={state} maxLength={1000} hint="Events Manager → Settings → Conversions API → Generate access token. Paste the whole token." />
        <div className="field">
          <label htmlFor="capiTestCode" className="label">Test event code (optional)</label>
          <input id="capiTestCode" name="capiTestCode" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="TEST12345" className="input font-mono" />
          <p className="hint">Events then appear under Test events only. Clear it when you go live.</p>
          <FieldError state={state} name="capiTestCode" />
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

      <div className="flex flex-wrap items-center gap-3">
        <PendingButton pending={pending}>Save Facebook settings</PendingButton>
        <button type="button" disabled={testing} onClick={() => start(async () => { const r = await testFacebookConnection(); setTest(r); notify(r.ok, r.message); })} className="btn btn-outline">{testing ? 'Testing…' : 'Test connection'}</button>
        <FormMessage state={state} />
        {test && <span role="status" className={test.ok ? 'text-sm text-ok' : 'text-sm text-bad'}>{test.message}</span>}
      </div>
    </form>
  );
}
