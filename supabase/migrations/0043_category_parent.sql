-- Mother and child categories: Clothing → Shirt, T-Shirt, Pant …
-- One level only: a child cannot have children of its own.
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

alter table public.categories drop constraint if exists categories_parent_not_self;
alter table public.categories add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);

create index if not exists categories_parent_idx on public.categories (parent_id);

create or replace function public.categories_one_level()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
      raise exception 'A child category cannot be a mother category' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'This category has child categories, so it cannot go under another one' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_one_level on public.categories;
create trigger categories_one_level
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_one_level();
