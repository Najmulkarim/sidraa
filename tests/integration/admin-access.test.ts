import { describe, expect, it } from 'vitest';
import { orderPayload, service, userClient, V } from './helpers';

describe('admin access through the API', () => {
  it('a signed-in non-admin reads no orders and cannot change status or stock', async () => {
    const { client } = await userClient(null);
    const { data } = await client.from('orders').select('id');
    expect(data ?? []).toEqual([]);

    const { data: placed } = await service().rpc('place_order', { p_payload: orderPayload([{ variant_id: V.scarf, quantity: 1 }]) });
    const ref = (Array.isArray(placed) ? placed[0] : placed).public_ref;
    const { data: order } = await service().from('orders').select('id').eq('public_ref', ref).single();

    const status = await client.rpc('set_order_status', { p_order_id: order!.id, p_status: 'confirmed' });
    expect(status.error?.message).toBe('FORBIDDEN');
    const stock = await client.rpc('adjust_stock', { p_variant_id: V.scarf, p_change: 100, p_reason: 'restock' });
    expect(stock.error?.message).toBe('FORBIDDEN');
    const direct = await client.from('product_variants').update({ stock: 999 }).eq('id', V.scarf);
    expect(direct.error).not.toBeNull();

    await service().from('orders').delete().eq('public_ref', ref);
  });

  it('support can read orders and move status, but cannot change settings', async () => {
    const { client } = await userClient('support');
    const { data: placed } = await service().rpc('place_order', { p_payload: orderPayload([{ variant_id: V.scarf, quantity: 1 }]) });
    const ref = (Array.isArray(placed) ? placed[0] : placed).public_ref;
    const { data: order } = await client.from('orders').select('id').eq('public_ref', ref).single();
    expect(order?.id).toBeTruthy();

    const { error } = await client.rpc('set_order_status', { p_order_id: order!.id, p_status: 'confirmed', p_note: 'test' });
    expect(error).toBeNull();

    const before = await service().from('store_settings').select('store_name').eq('id', 1).single();
    await client.from('store_settings').update({ store_name: 'Hacked by support' }).eq('id', 1);
    const after = await service().from('store_settings').select('store_name').eq('id', 1).single();
    expect(after.data!.store_name).toBe(before.data!.store_name);

    await service().from('orders').delete().eq('public_ref', ref);
  });

  it('super admin can change settings', async () => {
    const { client } = await userClient('super_admin');
    const before = await service().from('store_settings').select('tagline').eq('id', 1).single();
    const { error } = await client.from('store_settings').update({ tagline: 'Owner was here' }).eq('id', 1);
    expect(error).toBeNull();
    const after = await service().from('store_settings').select('tagline').eq('id', 1).single();
    expect(after.data!.tagline).toBe('Owner was here');
    await service().from('store_settings').update({ tagline: before.data!.tagline }).eq('id', 1);
  });

  it('only staff with the catalog permission can upload product photos', async () => {
    const { client: user } = await userClient(null);
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const denied = await user.storage.from('product-images').upload(`products/test-${Date.now()}.png`, file, { contentType: 'image/png' });
    expect(denied.error).not.toBeNull();

    const { client: staff } = await userClient('manager');
    const path = `products/test-${Date.now()}.png`;
    const allowed = await staff.storage.from('product-images').upload(path, file, { contentType: 'image/png' });
    expect(allowed.error).toBeNull();
    await staff.storage.from('product-images').remove([path]);
  });
});
