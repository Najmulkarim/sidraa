-- SMS to the customer when an order is placed. Settings → SMS: the SMS company,
-- its API key (secret: only the server reads it), the sender ID and the message.
create table if not exists public.sms_settings (
  id          int primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  provider    text not null default 'bulksmsbd' check (provider in ('bulksmsbd', 'smsnetbd')),
  api_key     text check (char_length(api_key) <= 300),
  sender_id   text check (char_length(sender_id) <= 40),
  order_text  text not null default 'Dear {name}, your order {order} of Tk {total} is placed at {store}. We will call you to confirm. Track: {track}'
              check (char_length(order_text) between 1 and 480),
  updated_at  timestamptz not null default now()
);
insert into public.sms_settings (id) values (1) on conflict (id) do nothing;
alter table public.sms_settings enable row level security;
revoke all on public.sms_settings from public, anon, authenticated;

-- What was sent, so staff can see that the customer got it (or why not).
create table if not exists public.sms_log (
  id         bigint generated always as identity primary key,
  order_id   uuid references public.orders(id) on delete cascade,
  phone      text not null,
  kind       text not null default 'order_placed',
  ok         boolean not null,
  detail     text check (char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists sms_log_order_idx on public.sms_log (order_id);
create index if not exists sms_log_created_idx on public.sms_log (created_at desc);
alter table public.sms_log enable row level security;
revoke all on public.sms_log from public, anon, authenticated;
