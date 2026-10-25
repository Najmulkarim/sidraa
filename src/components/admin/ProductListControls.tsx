'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteProductFromList, duplicateProduct, setProductFlags } from '@/actions/admin-catalog';
import { Icon } from '../icons';

/** Pill switch; the parent decides what a flip does. */
function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-1.5 text-left disabled:opacity-60"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-[11.5px] leading-tight text-muted">{label}</span>
    </button>
  );
}

export function CopySku({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy SKU"
      aria-label={`Copy SKU ${sku}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(sku);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard blocked (insecure origin or permissions): nothing to do.
        }
      }}
      className="grid h-5 w-5 shrink-0 place-items-center rounded border border-line text-brand hover:bg-tint"
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  );
}

/** Published / Featured switches and the edit, duplicate and delete buttons under each product card. */
export function ProductCardControls({ id, name, published, featured, archived }: { id: string; name: string; published: boolean; featured: boolean; archived: boolean }) {
  const [isPublished, setPublished] = useState(published);
  const [isFeatured, setFeatured] = useState(featured);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, undo?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) undo?.();
      if (res.message) setMessage({ ok: res.ok, text: res.message });
    });
  }

  return (
    <div className="space-y-2.5 border-t border-line p-2.5">
      <div className="flex flex-col gap-1.5">
        <Switch
          checked={isPublished}
          disabled={pending}
          label={isPublished ? 'Published' : archived ? 'Archived' : 'Draft'}
          onChange={(next) => {
            setPublished(next);
            run(() => setProductFlags(id, { published: next }), () => setPublished(!next));
          }}
        />
        <Switch
          checked={isFeatured}
          disabled={pending}
          label="Featured"
          onChange={(next) => {
            setFeatured(next);
            run(() => setProductFlags(id, { featured: next }), () => setFeatured(!next));
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
          <Link href={`/admin/products/${id}`} title="Edit" aria-label={`Edit ${name}`} className="grid h-8 place-items-center rounded-lg border border-line hover:border-brand hover:text-brand">
            <Icon name="pencil" size={15} />
          </Link>
          <button type="button" disabled={pending} title="Duplicate" aria-label={`Duplicate ${name}`} onClick={() => run(() => duplicateProduct(id))} className="grid h-8 place-items-center rounded-lg border border-line hover:border-brand hover:text-brand disabled:opacity-50">
            <Icon name="copy" size={15} />
          </button>
          <button
            type="button"
            disabled={pending}
            title="Delete"
            aria-label={`Delete ${name}`}
            onClick={() => {
              if (window.confirm(`Delete "${name}"? Its photos are deleted too. This cannot be undone.`)) run(() => deleteProductFromList(id));
            }}
            className="grid h-8 place-items-center rounded-lg border border-line text-bad hover:border-bad hover:bg-bad/5 disabled:opacity-50"
          >
            <Icon name="trash" size={15} />
          </button>
      </div>
      {message && (
        <p role="status" className={`rounded-lg px-2 py-1.5 text-[11px] leading-snug ${message.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** "Per page" select: changing it reloads the list from page 1. */
export function PerPageSelect({ value, options }: { value: number; options: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-muted">
      Per page:
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('per', e.target.value);
          next.delete('page');
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="input !min-h-9 w-20 !py-1 !text-[13px]"
      >
        {options.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  );
}
