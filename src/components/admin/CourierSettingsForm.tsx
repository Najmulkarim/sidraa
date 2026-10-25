'use client';

import { useState, useTransition } from 'react';
import { testCourier } from '@/actions/admin-courier';
import { saveCourierSettings } from '@/actions/admin-settings';
import type { ActionState } from '@/lib/types';
import { CopyField, SecretInput } from './SecretInput';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';
import { notify } from './Toaster';

export type CourierSettingsView = {
  default_courier: 'steadfast' | 'pathao' | null;
  steadfast_base_url: string;
  steadfast_api_key: string | null;
  steadfast_secret_key: string | null;
  steadfast_webhook_token: string | null;
  pathao_sandbox: boolean;
  pathao_client_id: string | null;
  pathao_client_secret: string | null;
  pathao_username: string | null;
  pathao_password: string | null;
  pathao_store_id: string | null;
  pathao_webhook_secret: string | null;
  pathao_integration_secret: string | null;
  default_weight_kg: number | string;
  parcel_note: string | null;
  auto_sync: boolean;
  steadfast_ready: boolean;
  pathao_ready: boolean;
};

export function CourierSettingsForm({ settings: c, siteUrl }: { settings: CourierSettingsView; siteUrl: string }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveCourierSettings);
  const [test, setTest] = useState<ActionState | null>(null);
  const [testing, start] = useTransition();
  const runTest = (courier: 'steadfast' | 'pathao') => start(async () => { const r = await testCourier(courier); setTest(r); notify(r.ok, r.message); });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">General</h2>
        <div className="field">
          <label htmlFor="defaultCourier" className="label">Default courier</label>
          <select id="defaultCourier" name="defaultCourier" defaultValue={c.default_courier ?? ''} className="input">
            <option value="">Ask every time</option>
            <option value="steadfast">Steadfast</option>
            <option value="pathao">Pathao</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="defaultWeightKg" className="label">Parcel weight (kg, Pathao)</label>
          <input id="defaultWeightKg" name="defaultWeightKg" inputMode="decimal" defaultValue={String(c.default_weight_kg)} className="input" />
          <FieldError state={state} name="defaultWeightKg" />
        </div>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="autoSync" defaultChecked={c.auto_sync} className="h-4 w-4 accent-[var(--brand)]" />
          Check parcel status automatically
        </label>
        <div className="field sm:col-span-3">
          <label htmlFor="parcelNote" className="label">Note on every parcel</label>
          <input id="parcelNote" name="parcelNote" defaultValue={c.parcel_note ?? ''} maxLength={200} placeholder="e.g. Handle with care. Call before delivery." className="input" />
        </div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <h2 className="font-semibold">Steadfast {c.steadfast_ready && <span className="badge badge-ok ml-1">Connected</span>}</h2>
          <button type="button" className="btn btn-outline btn-sm" disabled={testing || !c.steadfast_ready} onClick={() => runTest('steadfast')}>Test connection</button>
        </div>
        <SecretInput name="steadfastApiKey" label="API key" saved={c.steadfast_api_key} state={state} />
        <SecretInput name="steadfastSecretKey" label="Secret key" saved={c.steadfast_secret_key} state={state} />
        <div className="field">
          <label htmlFor="steadfastBaseUrl" className="label">API address</label>
          <input id="steadfastBaseUrl" name="steadfastBaseUrl" defaultValue={c.steadfast_base_url} className="input font-mono text-[12.5px]" />
          <p className="hint">Keep the default unless Steadfast tells you otherwise.</p>
          <FieldError state={state} name="steadfastBaseUrl" />
        </div>
        <SecretInput name="steadfastWebhookToken" label="Webhook token" saved={c.steadfast_webhook_token} state={state} generate hint="Paste the same token as the Bearer token in Steadfast's webhook settings." />
        <div className="sm:col-span-2"><CopyField label="Steadfast webhook URL" value={`${siteUrl}/api/webhooks/steadfast`} /></div>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <h2 className="font-semibold">Pathao {c.pathao_ready && <span className="badge badge-ok ml-1">Connected</span>}</h2>
          <button type="button" className="btn btn-outline btn-sm" disabled={testing || !c.pathao_ready} onClick={() => runTest('pathao')}>Test connection</button>
        </div>
        <SecretInput name="pathaoClientId" label="Client ID" saved={c.pathao_client_id} state={state} />
        <SecretInput name="pathaoClientSecret" label="Client secret" saved={c.pathao_client_secret} state={state} />
        <div className="field">
          <label htmlFor="pathaoUsername" className="label">Merchant login email</label>
          <input id="pathaoUsername" name="pathaoUsername" type="email" defaultValue={c.pathao_username ?? ''} autoComplete="off" className="input" />
          <FieldError state={state} name="pathaoUsername" />
        </div>
        <SecretInput name="pathaoPassword" label="Merchant login password" saved={c.pathao_password} state={state} />
        <div className="field">
          <label htmlFor="pathaoStoreId" className="label">Store ID</label>
          <input id="pathaoStoreId" name="pathaoStoreId" inputMode="numeric" defaultValue={c.pathao_store_id ?? ''} className="input" />
          <p className="hint">Pathao merchant panel → Stores.</p>
          <FieldError state={state} name="pathaoStoreId" />
        </div>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="pathaoSandbox" defaultChecked={c.pathao_sandbox} className="h-4 w-4 accent-[var(--brand)]" />
          Sandbox (testing, no real parcels)
        </label>
        <SecretInput name="pathaoWebhookSecret" label="Webhook secret" saved={c.pathao_webhook_secret} state={state} generate hint="Use the same secret when adding the webhook in Pathao." />
        <SecretInput name="pathaoIntegrationSecret" label="Integration secret" saved={c.pathao_integration_secret} state={state} hint="Shown by Pathao when you add the webhook." />
        <div className="sm:col-span-2"><CopyField label="Pathao webhook URL" value={`${siteUrl}/api/webhooks/pathao`} /></div>
      </section>

      {test && <FormMessage state={test} />}
      <div className="flex items-center gap-3">
        <PendingButton pending={pending}>Save courier settings</PendingButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
