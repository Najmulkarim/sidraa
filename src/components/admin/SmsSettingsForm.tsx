'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveSmsSettings, sendTestSms } from '@/actions/admin-sms';
import { formatDateTime } from '@/lib/format';
import { Icon } from '../icons';
import { notify } from './Toaster';
import { FormMessage, PendingButton, useKeepValuesAction } from './ui';

export type SmsView = { enabled: boolean; provider: 'bulksmsbd' | 'smsnetbd'; keyHint: string | null; senderId: string; orderText: string };
export type SmsLogRow = { id: number; phone: string; kind: string; ok: boolean; detail: string | null; created_at: string; ref: string | null };

const PROVIDERS = [
  { key: 'bulksmsbd', name: 'BulkSMSBD', site: 'bulksmsbd.net' },
  { key: 'smsnetbd', name: 'SMS.net.bd (Alpha SMS)', site: 'sms.net.bd' },
] as const;
const WORDS = [['{name}', 'customer’s first name'], ['{order}', 'order number'], ['{total}', 'amount to pay'], ['{store}', 'shop name'], ['{track}', 'order tracking link']] as const;

/** Settings → SMS: company, key, sender ID, the "order placed" message, a test SMS and the latest SMS sent. */
export function SmsSettingsForm({ view, log }: { view: SmsView; log: SmsLogRow[] }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveSmsSettings);
  const [text, setText] = useState(view.orderText);
  const [testTo, setTestTo] = useState('');
  const [testing, start] = useTransition();
  const router = useRouter();
  // A Bangla letter makes the SMS "Unicode": 70 letters per part instead of 160.
  const unicode = /[^\u0000-\u007f]/.test(text);
  const per = unicode ? 70 : 160;
  const sample = text.replace('{name}', 'Rahima').replace('{order}', 'SDR-0123').replace('{total}', '1,250').replace('{store}', 'Sidraa').replace('{track}', 'sidraabd.com/track');
  const parts = Math.max(1, Math.ceil(sample.length / per));

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="card space-y-5 p-5">
        <div>
          <h2 className="font-semibold">SMS to customers</h2>
          <p className="text-sm text-muted">When a customer places an order, they get an SMS at once. You need an account with an SMS company in Bangladesh (about 25–35 paisa per SMS); copy its <b>API key</b> and your approved <b>Sender ID</b> here.</p>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" name="enabled" defaultChecked={view.enabled} className="h-5 w-5 accent-[var(--brand)]" />
          <span><span className="font-semibold">Send an SMS when an order is placed</span><span className="block text-[12.5px] text-muted">Switch off any time; nothing is sent while it is off.</span></span>
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="field">
            <label className="label" htmlFor="sms-provider">SMS company</label>
            <select id="sms-provider" name="provider" defaultValue={view.provider} className="input">
              {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.name} — {p.site}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label flex justify-between" htmlFor="sms-key"><span>API key</span>{view.keyHint && <span className="font-mono text-[11px] font-normal text-ok">saved {view.keyHint}</span>}</label>
            <input id="sms-key" name="apiKey" type="password" autoComplete="off" spellCheck={false} maxLength={300} placeholder={view.keyHint ? 'Leave empty to keep the saved key' : 'From the SMS company’s panel → API'} className="input font-mono" />
            {view.keyHint && <label className="flex items-center gap-2 text-[12px] text-muted"><input type="checkbox" name="removeKey" className="h-3.5 w-3.5" /> Remove the saved key</label>}
          </div>
          <div className="field">
            <label className="label" htmlFor="sms-sender">Sender ID</label>
            <input id="sms-sender" name="senderId" defaultValue={view.senderId} maxLength={40} placeholder="e.g. Sidraa or 8809617…" className="input" />
            <p className="hint">The name or number the SMS comes from, as approved by the SMS company.</p>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="sms-text">Order placed message</label>
          <textarea id="sms-text" name="orderText" rows={3} maxLength={480} value={text} onChange={(e) => setText(e.target.value)} className="input" />
          <p className="hint">
            These words are filled in: {WORDS.map(([w, d], i) => <span key={w}>{i > 0 && ', '}<button type="button" onClick={() => setText((t) => `${t}${t.endsWith(' ') || !t ? '' : ' '}${w}`)} className="font-mono font-semibold text-brand hover:underline">{w}</button> {d}</span>)}.
          </p>
          <div className="rounded-xl bg-soft p-3 text-[13px]">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">The customer sees</p>
            <p className="mt-1 whitespace-pre-wrap">{sample}</p>
            <p className={`mt-1 text-[11.5px] ${parts > 1 ? 'text-warn' : 'text-muted'}`}>{sample.length} letters · {parts} SMS{parts > 1 ? ' (charged as ' + parts + ')' : ''}{unicode ? ' · Bangla: 70 letters per SMS' : ''}</p>
          </div>
        </div>

        <FormMessage state={state} />
        <PendingButton pending={pending}>Save SMS settings</PendingButton>
      </form>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Send a test SMS</h2>
        <p className="text-sm text-muted">Uses the <b>saved</b> settings (save first). The test message is the order message with sample details.</p>
        <div className="flex max-w-md gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" aria-label="Test number" className="input" />
          <button type="button" disabled={testing || !testTo} onClick={() => start(async () => { const r = await sendTestSms(testTo); notify(r.ok, r.message); router.refresh(); })} className="btn btn-outline btn-sm min-h-11 whitespace-nowrap">
            <Icon name="send" size={15} /> {testing ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Latest SMS</h2>
        {log.length === 0 ? <p className="text-sm text-muted">No SMS sent yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${l.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{l.ok ? 'Sent' : 'Failed'}</span>
                <span className="font-mono text-[13px]">{l.phone}</span>
                <span className="text-muted">{l.kind === 'test' ? 'Test' : l.ref ? `Order ${l.ref}` : 'Order'}</span>
                {!l.ok && l.detail && <span className="text-[12.5px] text-bad">{l.detail}</span>}
                <span className="ml-auto text-[12px] text-muted">{formatDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
