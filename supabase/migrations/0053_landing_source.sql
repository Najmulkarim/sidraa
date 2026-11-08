-- How a landing page was started: from a design on the Designs list ('design'),
-- or with the plain "New landing page" button ('manual'). Shown on the list.
alter table public.landing_pages
  add column if not exists source text not null default 'manual' check (source in ('manual', 'design'));

-- The pages made so far: Showcase and Story ones came from those designs.
update public.landing_pages set source = 'design' where template in ('showcase', 'story');
