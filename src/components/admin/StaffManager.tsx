'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteStaff, saveRolePermissions, saveStaff } from '@/actions/admin-settings';
import { Icon } from '../icons';
import { ConfirmDialog } from './ConfirmDialog';
import { PasswordInput } from './PasswordInput';
import { SavedPassword } from './SavedPassword';
import { notify } from './Toaster';
import { PERMISSION_LABEL, PERMISSIONS, ROLE_LABEL, ROLES, type AdminRole, type Permission } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

// The same columns for every staff row and the add form, so labels and boxes line up.
const ROW = 'grid items-start gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-[1fr_1.25fr_1fr_9.5rem_auto]';

export type StaffMember = { user_id: string; email: string; full_name: string; role: AdminRole; is_active: boolean; mfa: boolean; created_at: string };

function StaffRow({ m, isMe }: { m: StaffMember; isMe: boolean }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveStaff);
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [deleting, start] = useTransition();
  // Super admins are never deleted from here (nor yourself); everyone else can be.
  const canDelete = !isMe && m.role !== 'super_admin';
  const remove = () => start(async () => {
    const r = await deleteStaff(m.user_id);
    notify(r.ok, r.message);
    setAsking(false);
    if (r.ok) router.refresh();
  });
  return (
    <form onSubmit={onSubmit} className={`${ROW} py-5`} noValidate>
      <input type="hidden" name="userId" value={m.user_id} />
      <div className="field">
        <label className="label flex items-center gap-1.5" htmlFor={`sn-${m.user_id}`}>Name {isMe && <span className="badge badge-brand py-0 text-[10.5px]">You</span>}</label>
        <input id={`sn-${m.user_id}`} name="fullName" defaultValue={m.full_name} maxLength={80} className="input" />
        <FieldError state={state} name="fullName" />
      </div>
      <div className="field min-w-0">
        <label className="label" htmlFor={`se-${m.user_id}`}>Login email</label>
        {isMe ? (
          <input id={`se-${m.user_id}`} value={m.email} readOnly title="Change your own email under My account" className="input cursor-default bg-soft font-mono text-[13px] text-muted" />
        ) : (
          <input id={`se-${m.user_id}`} name="email" type="email" defaultValue={m.email} autoComplete="off" maxLength={120} className="input font-mono text-[13px]" />
        )}
        <FieldError state={state} name="email" />
        <p className="hint">{m.mfa ? 'Two-step sign-in on' : 'No two-step sign-in'} · since {formatDate(m.created_at)}</p>
      </div>
      {isMe ? (
        <div className="field">
          <span className="label">Password</span>
          <p className="input flex items-center bg-soft text-[13px] text-muted">Change it in My account</p>
        </div>
      ) : (
        <div>
          <PasswordInput id={`sp-${m.user_id}`} name="password" label="New password (optional)" placeholder="Leave empty to keep" ariaLabel={`New password for ${m.full_name}`} />
          <SavedPassword key={state.message ?? ''} userId={m.user_id} />
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor={`sr-${m.user_id}`}>Role</label>
        <select id={`sr-${m.user_id}`} name="role" defaultValue={m.role} disabled={isMe} className="input">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        {isMe && <input type="hidden" name="role" value={m.role} />}
      </div>
      <div className="field">
        <span className="label hidden lg:block" aria-hidden>&nbsp;</span>
        <div className="flex min-h-11 items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={m.is_active} disabled={isMe} className="h-4 w-4 accent-[var(--brand)]" />
            {isMe && <input type="hidden" name="isActive" value="on" />}
            Active
          </label>
          <PendingButton pending={pending} className="btn btn-outline btn-sm">Save</PendingButton>
          {canDelete ? (
            <button type="button" onClick={() => setAsking(true)} title={`Delete ${m.full_name}`} aria-label={`Delete ${m.full_name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-bad transition hover:bg-bad/10">
              <Icon name="trash" size={18} />
            </button>
          ) : <span className="w-9 shrink-0" aria-hidden />}
        </div>
      </div>
      <ConfirmDialog open={asking} title={`Delete ${m.full_name}?`} confirmLabel="Yes, delete" pendingLabel="Deleting…" pending={deleting} onConfirm={remove} onClose={() => setAsking(false)}>
        Their login ({m.email}) is removed and they can no longer sign in. Orders and notes they worked on stay; their open orders become unassigned. To only stop them for now, untick <b>Active</b> instead.
      </ConfirmDialog>
      <div className="lg:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}

function AddStaff() {
  const { state, onSubmit, pending } = useKeepValuesAction(saveStaff);
  const ref = useRef<HTMLFormElement>(null);
  // A new key empties the password box too after a successful add.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.ok) { ref.current?.reset(); setFormKey((k) => k + 1); }
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className={`${ROW} mt-2 rounded-2xl border border-dashed border-line bg-soft/50 p-4`} noValidate>
      <h3 className="font-semibold lg:col-span-5">Add a staff member</h3>
      <input type="hidden" name="isActive" value="on" />
      <div className="field">
        <label className="label" htmlFor="ns-name">Name</label>
        <input id="ns-name" name="fullName" maxLength={80} className="input" />
        <FieldError state={state} name="fullName" />
      </div>
      <div className="field min-w-0">
        <label className="label" htmlFor="ns-email">Login email</label>
        <input id="ns-email" name="email" type="email" autoComplete="off" className="input font-mono text-[13px]" />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <PasswordInput key={formKey} id="ns-pass" name="password" label="First password" />
        <FieldError state={state} name="password" />
      </div>
      <div className="field">
        <label className="label" htmlFor="ns-role">Role</label>
        <select id="ns-role" name="role" defaultValue="support" className="input">
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="label hidden lg:block" aria-hidden>&nbsp;</span>
        <div className="flex min-h-11 items-center"><PendingButton pending={pending} className="btn btn-primary btn-sm px-6">Add</PendingButton></div>
      </div>
      <div className="lg:col-span-5"><FormMessage state={state} /></div>
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
        <div className="mt-2 divide-y divide-line">
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
