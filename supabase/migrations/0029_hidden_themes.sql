-- 0029 — Themes the shop removed from its Homepage list. Safe to run again.
-- Removing only hides a theme (its sections stay), so Restore brings it back as it was.
begin;

alter table public.store_settings add column if not exists hidden_themes text[] not null default '{}';

commit;
