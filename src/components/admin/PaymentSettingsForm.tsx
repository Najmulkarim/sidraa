'use client';

import { useState, useTransition } from 'react';
import { savePaymentSettings, testBkash } from '@/actions/admin-payments';
import type { ActionState } from '@/lib/types';
import { SecretInput } from './SecretInput';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';
import { notify } from './Toaster';

/** What the page sends: switches and numbers as they are, secrets only as a masked hint. */
export type PaymentSettingsView = {
  cod_enabled: boolean;
  bkash_manual: boolean; bkash_number: string | null; bkash_number_type: string;
  nagad_manual: boolean; nagad_number: string | null; nagad_number_type: string;
  bkash_merchant: boolean; bkash_sandbox: boolean; bkash_app_key: string | null; bkash_app_secret: string | null; bkash_username: string | null; bkash_password: string | null;
  nagad_merchant: boolean; nagad_sandbox: boolean; nagad_merchant_id: string | null; nagad_public_key: string | null; nagad_private_key: string | null;
};

function Switch({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-line p-3">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
      <span><b className="block text-sm">{label}</b>{hint && <span className="text-[12.5px] text-muted">{hint}</span>}</span>
    </label>
  );
}

function Wallet({ prefix, name, s, state }: { prefix: 'bkash' | 'nagad'; name: string; s: PaymentSettingsView; state: ActionState }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="field">
        <label htmlFor={`${prefix}Number`} className="label">{name} number customers send to</label>
        <input id={`${prefix}Number`} name={`${prefix}Number`} type="tel" inputMode="tel" defaultValue={s[`${prefix}_number`] ?? ''} placeholder="01XXXXXXXXX" className="input" />
        <FieldError state={state} name={`${prefix}Number`} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}NumberType`} className="label">Account type</label>
        <select id={`${prefix}NumberType`} name={`${prefix}NumberType`} defaultValue={s[`${prefix}_number_type`]} className="input">
          <option value="personal">Personal (customer uses Send Money)</option>
          <option value="agent">Agent (customer uses Cash Out)</option>
          <option value="merchant">Merchant (customer uses Payment)</option>
        </select>
      </div>
    </div>
  );
}

/** Settings → Payments: cash on delivery, manual bKash / Nagad and the bKash / Nagad merchant gateways. */
export function PaymentSettingsForm({ settings: s }: { settings: PaymentSettingsView }) {
  const { state, onSubmit, pending } = useKeepValuesAction(savePaymentSettings);
  const [test, setTest] = useState<ActionState | null>(null);
  const [testing, start] = useTransition();

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Cash on delivery</h2>
        <Switch name="codEnabled" label="Offer cash on delivery" hint="The customer pays the rider. If every other option is off, this stays on." checked={s.cod_enabled} />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Manual payment (Send Money + Transaction ID)</h2>
          <p className="text-[13px] text-muted">The customer sends the total to your number and types the Transaction ID. You check it in your app and press “Payment received” on the order.</p>
        </div>
        <Switch name="bkashManual" label="bKash — manual" checked={s.bkash_manual} />
        <Wallet prefix="bkash" name="bKash" s={s} state={state} />
        <Switch name="nagadManual" label="Nagad — manual" checked={s.nagad_manual} />
        <Wallet prefix="nagad" name="Nagad" s={s} state={state} />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">bKash merchant (automatic)</h2>
          <p className="text-[13px] text-muted">The customer pays on bKash’s page and the order is marked paid automatically. Needs a bKash merchant account with “Tokenized Checkout”; bKash gives you these four values.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch name="bkashMerchant" label="Use bKash merchant payment" checked={s.bkash_merchant} />
          <Switch name="bkashSandbox" label="Test mode (sandbox)" hint="Untick when bKash gives you the live keys." checked={s.bkash_sandbox} />
          <SecretInput name="bkashAppKey" label="App key" saved={s.bkash_app_key} state={state} />
          <SecretInput name="bkashAppSecret" label="App secret" saved={s.bkash_app_secret} state={state} />
          <div className="field">
            <label htmlFor="bkashUsername" className="label">Username</label>
            <input id="bkashUsername" name="bkashUsername" defaultValue={s.bkash_username ?? ''} autoComplete="off" className="input font-mono" />
          </div>
          <SecretInput name="bkashPassword" label="Password" saved={s.bkash_password} state={state} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-outline btn-sm" disabled={testing} onClick={() => start(async () => { const r = await testBkash(); setTest(r); notify(r.ok, r.message); })}>{testing ? 'Testing…' : 'Test bKash connection'}</button>
          <span className="text-[12.5px] text-muted">Save first, then test.</span>
          {test && <span role="status" className={test.ok ? 'text-sm text-ok' : 'text-sm text-bad'}>{test.message}</span>}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Nagad merchant (automatic)</h2>
          <p className="text-[13px] text-muted">Save the keys Nagad gives you with a merchant account. The automatic Nagad page is switched on after a test payment with those keys — until then customers can pay Nagad manually.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch name="nagadMerchant" label="Use Nagad merchant payment" checked={s.nagad_merchant} />
          <Switch name="nagadSandbox" label="Test mode (sandbox)" checked={s.nagad_sandbox} />
          <div className="field">
            <label htmlFor="nagadMerchantId" className="label">Merchant ID</label>
            <input id="nagadMerchantId" name="nagadMerchantId" defaultValue={s.nagad_merchant_id ?? ''} autoComplete="off" className="input font-mono" />
          </div>
          <span />
          <SecretInput name="nagadPublicKey" label="Nagad public key" saved={s.nagad_public_key} state={state} />
          <SecretInput name="nagadPrivateKey" label="Your merchant private key" saved={s.nagad_private_key} state={state} />
        </div>
      </section>

      <FormMessage state={state} />
      <PendingButton pending={pending} className="btn btn-primary">Save payment settings</PendingButton>
    </form>
  );
}
