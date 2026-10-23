-- 0008 — Postgres-backed fixed-window rate limiter. Server-only.
-- Returns true when the call is allowed, false when the bucket is full.
-- Buckets look like 'checkout:ip:<salted hash>' — raw IPs are never stored.

create or replace function public.hit_rate_limit(p_bucket text, p_max_hits int, p_window_seconds int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits   int;
begin
  if p_bucket is null or char_length(p_bucket) > 200 or p_max_hits < 1
     or p_window_seconds not between 1 and 86400 then
    raise exception using message = 'INVALID_INPUT';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Opportunistic clean-up keeps the table small without a cron job.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max_hits;
end;
$$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant  execute on function public.hit_rate_limit(text, int, int) to service_role;
