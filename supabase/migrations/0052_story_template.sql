-- A third landing page design: 'story' (product-page top, the product's story in
-- blocks, big poster photos, order form, call / WhatsApp band).
alter table public.landing_pages drop constraint if exists landing_pages_template_check;
alter table public.landing_pages add constraint landing_pages_template_check check (template in ('classic', 'showcase', 'story'));
