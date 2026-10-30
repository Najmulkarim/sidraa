-- 0035 — Staff may save the dragged order of variation rows. Safe to run again.
-- product_variants allows updates column by column, so 0034's new column needs its own grant.
grant update (sort_order) on public.product_variants to authenticated;
