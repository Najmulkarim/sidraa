-- BD Courier answers, kept in our own database for seven days per phone number,
-- so the same number is never searched (and charged) twice in that time.
-- Only the server (service role) reads and writes it: RLS on, no policies.
create table if not exists public.courier_checks (
  phone      text primary key check (phone ~ '^01[0-9]{9}$'),
  result     jsonb not null,
  checked_at timestamptz not null default now()
);

alter table public.courier_checks enable row level security;
