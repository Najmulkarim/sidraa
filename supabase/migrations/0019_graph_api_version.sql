-- Conversions API: newer Graph API version (v21.0 is close to being retired).
alter table public.marketing_settings alter column graph_version set default 'v26.0';
update public.marketing_settings set graph_version = 'v26.0' where graph_version = 'v21.0';
