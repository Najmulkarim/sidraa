-- The password the owner last set for each staff member, so a super admin can
-- look it up later. Stored encrypted (AES-GCM; the key lives only on the server,
-- never in the database). No one can read this table through the API: only the
-- server, after checking that the person asking is a super admin.
create table if not exists public.staff_passwords (
  user_id uuid primary key references auth.users (id) on delete cascade,
  secret  text not null check (char_length(secret) <= 1000),
  set_at  timestamptz not null default now()
);

alter table public.staff_passwords enable row level security;
-- No policies on purpose: browsers (anon / signed-in) get nothing.
revoke all on public.staff_passwords from anon, authenticated;
