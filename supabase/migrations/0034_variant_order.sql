-- 0034 — Variation rows can be dragged into any order. Safe to run again.
-- 0 = never arranged: the shop keeps its automatic order (photos, S < M < L).
alter table public.product_variants add column if not exists sort_order int not null default 0;
