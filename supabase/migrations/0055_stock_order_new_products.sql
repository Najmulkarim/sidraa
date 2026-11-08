-- Stock-in orders can hold products that are not listed yet: a name, colour,
-- size, photo and selling price written on the line. Receiving the order makes
-- each new name a hidden Draft product (one variation per colour / size) with
-- that stock, photo and cost, and links the line to it. Safe to run again.

alter table public.stock_order_items alter column variant_id drop not null;
alter table public.stock_order_items
  add column if not exists new_name  text check (char_length(new_name) between 1 and 160),
  add column if not exists new_color text check (char_length(new_color) <= 30),
  add column if not exists new_size  text check (char_length(new_size) <= 20),
  add column if not exists new_image text check (char_length(new_image) <= 300),
  add column if not exists new_price numeric(12,2) check (new_price is null or new_price >= 0),
  add column if not exists product_id uuid references public.products (id) on delete set null;
alter table public.stock_order_items drop constraint if exists stock_order_items_what_chk;
alter table public.stock_order_items add constraint stock_order_items_what_chk check (variant_id is not null or new_name is not null);

create or replace function public.receive_stock_order(p_order_id uuid, p_save_costs boolean default false)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.stock_orders%rowtype;
  v_item record;
  v_units int := 0;
  v_product uuid;
  v_variant uuid;
  v_slug text;
  v_img_order int;
begin
  perform public.require_permission('inventory');
  select * into v_order from public.stock_orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_order.status <> 'draft' then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'status', 'reason', 'This stock-in order was already ' || v_order.status)::text;
  end if;
  if not exists (select 1 from public.stock_order_items where stock_order_id = p_order_id) then
    raise exception using message = 'INVALID_INPUT', detail = jsonb_build_object('field', 'items', 'reason', 'Add at least one product')::text;
  end if;

  for v_item in
    select i.* from public.stock_order_items i where i.stock_order_id = p_order_id order by (i.variant_id is null), i.new_name, i.id
  loop
    v_variant := v_item.variant_id;

    if v_variant is null then
      -- A new product: one per name in this order (same name = same product, another colour / size).
      select i.product_id into v_product
        from public.stock_order_items i
       where i.stock_order_id = p_order_id and i.product_id is not null and lower(i.new_name) = lower(v_item.new_name)
       limit 1;
      if v_product is null then
        v_slug := trim(both '-' from regexp_replace(lower(v_item.new_name), '[^a-z0-9]+', '-', 'g'));
        v_slug := left(coalesce(nullif(v_slug, ''), 'product'), 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
        insert into public.products (name, slug, base_price, status)
        values (v_item.new_name, v_slug, coalesce(v_item.new_price, v_item.unit_cost, 0), 'draft')
        returning id into v_product;
      end if;

      if v_item.new_image is not null and not exists (select 1 from public.product_images pi where pi.product_id = v_product and pi.storage_path = v_item.new_image) then
        select coalesce(max(pi.sort_order), -1) + 1 into v_img_order from public.product_images pi where pi.product_id = v_product;
        insert into public.product_images (product_id, storage_path, sort_order) values (v_product, v_item.new_image, v_img_order);
      end if;

      select pv.id into v_variant from public.product_variants pv
       where pv.product_id = v_product and pv.color = coalesce(v_item.new_color, '') and pv.size = coalesce(v_item.new_size, '') and pv.option3 = '';
      if v_variant is null then
        insert into public.product_variants (product_id, color, size, image_path, stock)
        values (v_product, coalesce(v_item.new_color, ''), coalesce(v_item.new_size, ''), v_item.new_image, 0)
        returning id into v_variant;
      end if;

      update public.stock_order_items set product_id = v_product where id = v_item.id;
      -- Link the line to its new variation (unless another line of this order already points at it).
      if not exists (select 1 from public.stock_order_items i where i.stock_order_id = p_order_id and i.variant_id = v_variant) then
        update public.stock_order_items set variant_id = v_variant where id = v_item.id;
      end if;
      if v_item.unit_cost is not null then
        insert into public.variant_costs (variant_id, cost) values (v_variant, v_item.unit_cost)
        on conflict (variant_id) do update set cost = excluded.cost, updated_at = now();
      end if;
      v_product := null;
    elsif p_save_costs and v_item.unit_cost is not null and public.has_permission('catalog') then
      insert into public.variant_costs (variant_id, cost) values (v_variant, v_item.unit_cost)
      on conflict (variant_id) do update set cost = excluded.cost, updated_at = now();
    end if;

    update public.product_variants set stock = stock + v_item.quantity where id = v_variant;
    insert into public.inventory_movements (variant_id, change, reason, note, created_by, stock_order_id)
    values (v_variant, v_item.quantity, 'restock', 'Stock-in ' || v_order.ref || coalesce(' · ' || v_order.supplier, ''), auth.uid(), p_order_id);
    v_units := v_units + v_item.quantity;
  end loop;

  update public.stock_orders set status = 'received', received_at = now(), received_by = auth.uid() where id = p_order_id;
  return v_units;
end;
$$;
revoke execute on function public.receive_stock_order(uuid, boolean) from public, anon;
grant execute on function public.receive_stock_order(uuid, boolean) to authenticated;
