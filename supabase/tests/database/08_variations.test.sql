-- Variations: colour / size / a third option, and a photo per variation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select is(public.variant_label('Navy', 'XL', 'Half sleeve'), 'Navy / XL / Half sleeve', 'label joins colour, size and the third option');
select is(public.variant_label('', 'M', ''), 'M', 'empty parts are skipped');

-- Seed: Men Classic Oxford Shirt has Navy/White/Maroon × M/L/XL × Full/Half sleeve.
select is((select count(*)::int from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'men-classic-oxford-shirt'), 18,
  'three variation types make 18 combinations');
select is((public.quote_order(jsonb_build_array(jsonb_build_object('variant_id',
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
    where p.slug = 'men-classic-oxford-shirt' and v.color = 'White' and v.size = 'L' and v.option3 = 'Half sleeve'), 'quantity', 1))) -> 'lines' -> 0 ->> 'variant_label'),
  'White / L / Half sleeve', 'the quote names the full variation');

select throws_ok($$ insert into public.product_variants (product_id, sku, color, size, option3)
  select product_id, 'DUP-1', color, size, option3 from public.product_variants where sku like 'MCOS24-NAV-M-F' $$,
  '23505', null, 'the same colour + size + option cannot exist twice');
select throws_ok($$ update public.product_variants set image_path = '/demo/p-floral-maxi-dress.svg' where sku = 'MCOS24-NAV-M-F' $$,
  'P0001', 'INVALID_INPUT', 'a variation photo must be one of the same product''s photos');

delete from public.product_images where storage_path = '/demo/p-men-classic-oxford-shirt-maroon.svg';
select is((select count(*)::int from public.product_variants where color = 'Maroon' and sku like 'MCOS24%' and image_path is not null), 0,
  'deleting a photo clears it from the variations that used it');
select is((select count(*)::int from public.product_variants where color = 'White' and sku like 'MCOS24%' and image_path is not null), 6,
  'other colours keep their photo');

select * from finish();
rollback;
