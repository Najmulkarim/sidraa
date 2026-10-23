'use client';

import { useEffect, useRef } from 'react';
import { saveRolePermissions, saveStaff } from '@/actions/admin-settings';
import { PERMISSION_LABEL, PERMISSIONS, ROLE_LABEL, ROLES, type AdminRole, type Permission } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export type StaffMember = { user_id: string; email: string; full_name: string; role: AdminRole; is_active: boolean; mfa: boolean; created_at: string };

function StaffRow({ m, isMe }: { m: StaffMember; isMe: boolean }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveStaff);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 py-4 md:grid-cols-[1.2fr_1.3fr_10rem_auto_auto] md:items-end" noValidate>
      <input type="hidden" name="userId" value={m.user_id} />
      <div className="field">
        <label className="label" htmlFor={`sn-${m.user_id}`}>Name {isMe && <span className="badge badge-brand ml-1">You</span>}</label>
        <input id={`sn-${m.user_id}`} name="fullName" defaultValue={m.full_name} maxLength={80} className="input" />
        <FieldError state={state} name="fullName" />
      </div>
      <div className="field">
        <span className="label">Login</span>
        <p className="min-h-11 content-center truncate font-mono text-[12.5px] text-muted" title={m.email}>{m.email}</p>
        <p className="text-[11px] text-muted">{m.mfa ? 'Two-step sign-in on' : 'No two-step sign-in'} · since {formatDate(m.created_at)}</p>
      </div>
      <div className="field">
        <label className="label" htmlFor={`sr-${m.user_id}`}>Role</label>
        <select id={`sr-${m.user_id}`} name="role" defaultValue={m.role} disabled={isMe} className="input">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {isMe && <input type="hidden" name="role" value={m.role} />}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={m.is_active} disabled={isMe} className="h-4 w-4 accent-[var(--brand)]" />
        {isMe && <input type="hidden" name="isActive" value="on" />}
        Active
      </label>
      <PendingButton pending={pending} className="btn btn-outline btn-sm">Save</PendingButton>
      {!isMe && (
        <details className="md:col-span-5">
          <summary className="cursor-pointer text-[12px] text-muted">Set a new password</summary>
          <div className="mt-2 max-w-sm">
            <input name="password" type="password" autoComplete="new-password" minLength={10} placeholder="At least 10 characters" className="input" aria-label={`New password for ${m.full_name}`} />
            <FieldError state={state} name="password" />
          </div>
        </details>
      )}
      <div className="md:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}

function AddStaff() {
  const { state, onSubmit, pending } = useKeepValuesAction(saveStaff);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-paper p-4 md:grid-cols-[1fr_1.2fr_1fr_10rem_auto] md:items-end" noValidate>
      <h3 className="text-sm font-semibold md:col-span-5">Add a staff member</h3>
      <input type="hidden" name="isActive" value="on" />
      <div className="field">
        <label className="label" htmlFor="ns-name">Name</label>
        <input id="ns-name" name="fullName" maxLength={80} className="input" />
        <FieldError state={state} name="fullName" />
      </div>
      <div className="field">
        <label className="label" htmlFor="ns-email">Login email</label>
        <input id="ns-email" name="email" type="email" autoComplete="off" className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div className="field">
        <label className="label" htmlFor="ns-pass">First password</label>
        <input id="ns-pass" name="password" type="password" autoComplete="new-password" minLength={10} className="input" />
        <FieldError state={state} name="password" />
      </div>
      <div className="field">
        <label className="label" htmlFor="ns-role">Role</label>
        <select id="ns-role" name="role" defaultValue="support" className="input">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <PendingButton pending={pending} className="btn btn-primary btn-sm">Add</PendingButton>
      <div className="md:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}

function RoleForm({ role, granted }: { role: 'manager' | 'support'; granted: Permission[] }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveRolePermissions);
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line p-4">
      <input type="hidden" name="role" value={role} />
      <h3 className="font-semibold">{ROLE_LABEL[role]}</h3>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {PERMISSIONS.map((p) => (
          <li key={p}>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" name="permissions" value={p} defaultChecked={granted.includes(p)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" />
              <span>{PERMISSION_LABEL[p]}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <PendingButton pending={pending} className="btn btn-outline btn-sm">Save {ROLE_LABEL[role].toLowerCase()} permissions</PendingButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function StaffManager({ staff, meId, matrix }: { staff: StaffMember[]; meId: string; matrix: Record<'manager' | 'support', Permission[]> }) {
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">Staff</h2>
        <p className="text-sm text-muted">Switched-off staff cannot sign in to the admin, and their open orders are unassigned. There is no public sign-up.</p>
        <div className="divide-y divide-line">
          {staff.map((m) => <StaffRow key={m.user_id} m={m} isMe={m.user_id === meId} />)}
        </div>
        <AddStaff />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">What each role can do</h2>
          <p className="text-sm text-muted">Super admins can do everything, including this page. The database checks these permissions on every request — hiding a menu item is not the only protection.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <RoleForm role="manager" granted={matrix.manager} />
          <RoleForm role="support" granted={matrix.support} />
        </div>
      </section>
    </div>
  );
}
