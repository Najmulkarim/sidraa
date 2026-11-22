-- 0077 — Point the shop at smaller copies of 59 big product photos
-- (WebP, at most 1600 px, about 156 KB each instead of 1303 KB).
-- The site downloads a photo again every time it makes a new size of it, so
-- big originals used most of the storage traffic (Cached Egress). The new
-- copies are already uploaded next to the old ones; the old files are kept.
-- Replaces each old file name with the new one wherever it is written in the
-- public tables (photos, variant photos, descriptions, home page, settings).
-- Safe to run again: once replaced, nothing matches.

do $$
declare
  m record;
  c record;
  n int;
  total int := 0;
begin
  create temp table photo_map (old_path text, new_path text) on commit drop;
  insert into photo_map values
    ('products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/2e9f8ba9-1671-43ee-b8b3-d86f597ffba7.jpg', 'products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/690a6584-00df-4bbf-9a3a-b2755bee5be4.webp'),
    ('products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/320ec885-f67a-4c54-8150-c7973772fcce.jpg', 'products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/b13609f5-c0f6-435e-b028-3d486c0fdd70.webp'),
    ('products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/638eb043-bcdd-48c2-bd71-b11739f387be.jpg', 'products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/d648d08f-7562-4fa8-be3d-9a527823fa90.webp'),
    ('products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/77708894-c392-40dd-9f56-75b12ca5b922.jpg', 'products/09ad02d1-ea5e-40d2-b97d-5a4391cc5040/f9cf1042-5255-4fdc-8595-804fef7a732f.webp'),
    ('products/1a4a6ac6-9ea5-432a-896c-d0886735378f/602a44b3-9925-41f1-8c4a-18b041ba3033.png', 'products/1a4a6ac6-9ea5-432a-896c-d0886735378f/f9273737-5bae-4cd6-aef5-6757745e7fb8.webp'),
    ('products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/62634701-4f51-42de-b41d-9b735c1d55fc.jpg', 'products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/39a69da8-0552-4519-ad39-f4be2bf215b4.webp'),
    ('products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/692c34a9-0e1d-4e62-93af-7193f315ae68.jpg', 'products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/4fe21204-ddd1-45b7-a8c0-1546f5ecd666.webp'),
    ('products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/d59c006c-dc1d-4ddb-a38c-de27d9732dcb.jpg', 'products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/3870efb1-37b5-494a-ad65-614a7e8e2cf5.webp'),
    ('products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/ecfad896-d9f3-47bc-9cb8-b81e25804280.jpg', 'products/31a056e3-2a05-4a34-90d5-ac7e1bb190d2/fb858136-95bc-4493-b5cf-9bbda57379d5.webp'),
    ('products/34e32cf2-2b1c-43ac-b099-0c1a34c07aae/df490faf-b8a4-4f3f-b83d-303c28179b6a.png', 'products/34e32cf2-2b1c-43ac-b099-0c1a34c07aae/11b29dce-f35d-4c10-9d15-0005579e802b.webp'),
    ('products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/1a5ddab1-6429-4ad4-86b0-e429d949f05f.jpg', 'products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/68e2cdea-b285-4429-a396-c61cb9800faf.webp'),
    ('products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/35447568-8383-49bb-8aea-4a2aaf331376.jpg', 'products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/66559727-1c26-40cc-aa3a-eb3cd4a1d1fb.webp'),
    ('products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/3f194fb3-f74f-473a-ab17-c4aac6cc4034.jpg', 'products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/8c14ee85-520d-47ac-9baf-35612e87f9e5.webp'),
    ('products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/87c2cace-5186-4d4c-b935-9f316cb5706b.jpg', 'products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/1749b434-8ce1-488c-afc0-bcb0f6d337e1.webp'),
    ('products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/dada17be-fed6-4ff6-9e3c-72b5e871a7c7.jpg', 'products/4c7d804b-a0ca-4f31-aed5-f063e2900a44/c718223c-e9a9-4e97-8a6b-a9963c5dd8ea.webp'),
    ('products/7a81af25-3b73-442b-a78f-15b04a41bdce/7aff2686-74c3-4760-bc6f-09221fef0cba.jpg', 'products/7a81af25-3b73-442b-a78f-15b04a41bdce/6fd244a4-799d-4731-ae1a-e4222ad76791.webp'),
    ('products/7a81af25-3b73-442b-a78f-15b04a41bdce/c54ecc41-6812-4306-9c85-67833d9a0d51.jpg', 'products/7a81af25-3b73-442b-a78f-15b04a41bdce/29f2c150-390a-4e7f-b804-945729f4bcc8.webp'),
    ('products/84fca0b1-d681-42c1-bf2c-f9cb9c0c0209/97e5b57c-1215-4932-83e9-684ac9a968a7.jpg', 'products/84fca0b1-d681-42c1-bf2c-f9cb9c0c0209/31ff5232-e754-4a5a-8f29-bc7d7da7ed4a.webp'),
    ('products/84fca0b1-d681-42c1-bf2c-f9cb9c0c0209/fb4ba4ca-6bcd-4871-a026-7a0940e314e8.jpg', 'products/84fca0b1-d681-42c1-bf2c-f9cb9c0c0209/a32363d1-937b-49c3-aa9c-8d188ba7ba7a.webp'),
    ('products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/03e664c5-b805-40bd-a8ca-89788dc36068.jpg', 'products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/b911f7b0-afcc-44b7-a6a7-da999b180e65.webp'),
    ('products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/2523709d-4ee5-4c43-84a3-6898420e44f3.jpg', 'products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/218d0044-b3cc-4de7-8fe9-722cb02ae8f4.webp'),
    ('products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/db379608-60b2-4fa8-a43a-1b2bcdd4a9d5.jpg', 'products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/3b8e5da2-8d64-49d3-83d1-dec2327868da.webp'),
    ('products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/f71038e7-298f-4234-adb4-78cfb1bfb8f2.jpg', 'products/9123af45-bdd9-4c4a-b1f6-30c4e892c556/0753900a-fc4b-4487-93c7-fb6258cc4792.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/24d697f6-5d90-4390-9f91-e8875df79f26.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/e9ba6ce1-97e6-481f-9f78-5f4498ba6df6.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/3244e9f3-b4fd-431c-a18c-1499df1261cb.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/30c10635-7f0b-49e3-91c8-0c4c67364800.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/4ad6b8e0-a259-4436-888a-391e0fd5339f.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/efd3d611-4d71-4d4b-a049-cc54e1b0ffe4.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/6f77160a-ea11-4f0e-a057-5aafc1402d76.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/957f3aaf-d4b4-4211-bb84-115f855e460a.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/c74444c3-67ef-495d-ac29-125327af388b.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/3756abee-3b34-4a30-b7fa-59da1ee8a4cb.webp'),
    ('products/a090baae-3e37-4aec-be25-34d45255ff4b/e60a8f50-6d90-402e-9ff2-0a79956677db.png', 'products/a090baae-3e37-4aec-be25-34d45255ff4b/046889fc-a3f2-447b-984b-994e563ddb8b.webp'),
    ('products/a8ba0f8f-5e23-41a7-ae6e-a7da0e7f600a/01c477cf-edd7-4050-8b0a-71099dcdd232.png', 'products/a8ba0f8f-5e23-41a7-ae6e-a7da0e7f600a/d98e218a-8a49-4d02-a25e-05b7bc61c4d4.webp'),
    ('products/a8ba0f8f-5e23-41a7-ae6e-a7da0e7f600a/72a3718c-fcdf-4fdb-ad03-01be6d5bbe3c.png', 'products/a8ba0f8f-5e23-41a7-ae6e-a7da0e7f600a/3c94a6e4-d496-4f1f-b264-ce61f9e4f89e.webp'),
    ('products/ab1eee58-f599-4413-8a74-c69541b5636a/3b5afaee-eed0-49d8-afd3-4e23c724f466.jpg', 'products/ab1eee58-f599-4413-8a74-c69541b5636a/27d688e7-a7b0-4a68-8e7d-a846d1d15916.webp'),
    ('products/ab1eee58-f599-4413-8a74-c69541b5636a/c843bfab-7f5a-4f41-a3ef-caed8bfecdfb.jpg', 'products/ab1eee58-f599-4413-8a74-c69541b5636a/c3d2af9e-af17-43c2-be86-372d4e67bb2d.webp'),
    ('products/ab1eee58-f599-4413-8a74-c69541b5636a/e91f82b4-c46e-4d7b-8871-2ea86828be33.jpg', 'products/ab1eee58-f599-4413-8a74-c69541b5636a/bfceb6a5-ff39-47da-b36d-2aa03860fa42.webp'),
    ('products/b71bad3f-1fbe-446b-9612-b42c3092d206/0e177fb1-b990-49ea-a135-d62e59ea5079.jpg', 'products/b71bad3f-1fbe-446b-9612-b42c3092d206/3fa84f94-cb93-4313-81bb-53e91ce42006.webp'),
    ('products/b71bad3f-1fbe-446b-9612-b42c3092d206/10c66e62-6fa4-41ba-9362-fefb76824d95.jpg', 'products/b71bad3f-1fbe-446b-9612-b42c3092d206/0b1a5912-9e9f-4a43-ab24-6434a21617ca.webp'),
    ('products/b71bad3f-1fbe-446b-9612-b42c3092d206/4792e0a8-7d8a-4472-8df9-018df5d23f7e.jpg', 'products/b71bad3f-1fbe-446b-9612-b42c3092d206/97b4d0bf-dd6e-41ac-828b-e21110ca9645.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/1bd18ee6-e5f9-478c-b7ad-3b831715f5f3.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/3f6a2cb3-1ea1-449a-8363-27648bab407b.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/35d9c5f5-92f4-43e1-9a80-42fab448114d.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/da676c6a-599b-4cc2-b9b3-d95dd8aed499.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/849fb81f-46ce-4566-824b-3980c74d4616.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/218639b5-4434-4cd9-9bd8-6d3dc13874a5.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/8776163d-c647-4ad7-a722-67d7e7f76846.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/95811eab-eaad-43c7-879f-55d079b757a6.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/939b06b1-a75e-4dd6-8a29-758e7b700122.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/7a9a8109-0ef7-4aeb-800d-7a4b66f68614.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/a3269256-c257-4fdc-8ad8-c2ab0631acd5.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/db1b872b-25bf-4ab2-9022-b16752d47f83.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/b40dee37-882a-4453-87dd-56d0b4cc9cbe.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/c784386c-fd38-408a-8db1-189290c7f5bd.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/cbf75abb-555c-42a2-a0a2-0ad9aba51829.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/08f49b47-0060-4d98-a5be-750a157b615a.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/e0f080c8-f8e7-44a8-b1a2-30725afe3531.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/b38f6953-5224-467a-b439-bb377d22aa93.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/e661efab-4bed-46a8-9e67-ea31e4e1b2c1.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/47e6e224-74b0-4dc1-96d2-8a68a28f2dbb.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/edd85436-1fff-4ffb-bf8a-7eca2e9660e2.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/036f483e-32aa-407a-8ebe-d5d5a2713c12.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/ef8b2570-fee6-4256-b40e-ff2c94a57f38.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/bb3add85-f322-497e-8e67-734a873d2f8a.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/f3c9f622-b8ff-4208-8613-4c78866dd2c9.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/1c824320-8f32-482a-9244-95ae9650b279.webp'),
    ('products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/f4f1ee04-0e9b-40e7-a64e-dc7379fab847.png', 'products/bb9a1e4c-8e16-4db5-8bb1-8ac294d0495e/5b9c8e65-6291-4d22-97ee-e706322c5f5e.webp'),
    ('products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/89323efd-f769-44f4-ad2b-b8591056d4c8.png', 'products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/75409bbb-362b-4064-b54f-3cde18736402.webp'),
    ('products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/afe8e744-850e-4af9-868b-fa7da2921f89.png', 'products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/0a88b549-efc9-4d68-912d-a4c901617427.webp'),
    ('products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/b2586dd5-ed11-44d0-8ad9-9539d2e16c60.png', 'products/bc60382c-99ad-476e-8dc7-a01f1c01a1a7/559fe3e6-ae15-4afc-ad47-d3fd780f9c72.webp'),
    ('products/c3616135-c5d9-42df-88fa-686fe9d9281c/993342a6-0002-4d4c-a610-984fb38d73f2.jpg', 'products/c3616135-c5d9-42df-88fa-686fe9d9281c/b8337c02-f4ad-499d-bfee-ce1bcbe1c80b.webp'),
    ('products/c3616135-c5d9-42df-88fa-686fe9d9281c/a1dc5bbe-28fb-41ca-b7ac-77f4c7d14958.jpg', 'products/c3616135-c5d9-42df-88fa-686fe9d9281c/7a0a84ee-3ed2-4b84-9102-e1e467f341dc.webp'),
    ('products/c3616135-c5d9-42df-88fa-686fe9d9281c/c649367e-d0a8-4777-bedd-d4fd8ed65a62.jpg', 'products/c3616135-c5d9-42df-88fa-686fe9d9281c/8733cf54-e384-4cab-90c6-d398c0f1989f.webp'),
    ('products/c3616135-c5d9-42df-88fa-686fe9d9281c/cecf1657-cf03-4311-a021-acbb0be11401.jpg', 'products/c3616135-c5d9-42df-88fa-686fe9d9281c/6af68348-3303-467b-8c6a-2e7a1e9ef21d.webp'),
    ('products/c3616135-c5d9-42df-88fa-686fe9d9281c/ecff944d-e7a0-4413-9ccd-c12c0e42df5a.jpg', 'products/c3616135-c5d9-42df-88fa-686fe9d9281c/758b0143-5338-4b33-b6d4-e9071a52f46b.webp');

  for c in
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying', 'jsonb', 'json')
      and is_generated = 'NEVER'
      and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    for m in select * from photo_map loop
      if c.data_type in ('jsonb', 'json') then
        execute format('update public.%I set %I = replace(%I::text, $1, $2)::%s where %I::text like $3', c.table_name, c.column_name, c.column_name, c.data_type, c.column_name)
          using m.old_path, m.new_path, '%' || m.old_path || '%';
      else
        execute format('update public.%I set %I = replace(%I, $1, $2) where %I like $3', c.table_name, c.column_name, c.column_name, c.column_name)
          using m.old_path, m.new_path, '%' || m.old_path || '%';
      end if;
      get diagnostics n = row_count;
      if n > 0 then
        raise notice '%.%: % row(s) for %', c.table_name, c.column_name, n, m.old_path;
        total := total + n;
      end if;
    end loop;
  end loop;
  raise notice 'Done: % change(s).', total;
end $$;
