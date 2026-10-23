import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { anon, orderPayload, service, setStock, stockOf, userClient, V, ZONE_OUTSIDE } from './helpers';

/** Roles, secrets, coupons under concurrency and the full order editor, through the real API. */
describe('live-shop features', () => {
  const code = `IT${Date.now().toString(36).toUpperCase()}`;
  afterAll(async () => {
    await service().from('coupons').delete().eq('code', code);
  });

  it('courier keys and the Conversions API token are not readable by any browser session', async () => {
    const { client: support } = await userClient('support');
    const { client: boss } = await userClient('super_admin');
    for (const c of [anon(), support, boss]) {
      expect((await c.from('courier_settings').select('*')).error).not.toBeNull();
      expect((await c.from('marketing_settings').select('*')).error).not.toBeNull();
    }
    const masked = await boss.rpc('get_courier_settings');
    expect(masked.error).toBeNull();
    expect((await support.rpc('get_courier_settings')).error?.message).toBe('FORBIDDEN');
  });

  it('a one-use coupon is used once even when 8 buyers try it at the same time', async () => {
    await service().from('coupons').insert({ code, kind: 'fixed', value: 50, usage_limit: 1 });
    await setStock(V.maxiM, 50);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => service().rpc('place_order', { p_payload: orderPayload([{ variant_id: V.maxiM, quantity: 1 }], { coupon_code: code }) })),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.message === 'COUPON_INVALID')).toHaveLength(7);
    const { data } = await service().from('coupons').select('used_count').eq('code', code).single();
    expect(data!.used_count).toBe(1);
  });

  it('editing an order moves only the stock difference; support may not edit items', async () => {
    await setStock(V.maxiM, 10);
    await setStock(V.maxiXL, 10);
    const { data: placed } = await service().rpc('place_order', { p_payload: orderPayload([{ variant_id: V.maxiM, quantity: 3 }]) });
    const ref = (Array.isArray(placed) ? placed[0] : placed).public_ref;
    const { data: o } = await service().from('orders').select('id').eq('public_ref', ref).single();
    expect(await stockOf(V.maxiM)).toBe(7);

    const payload = {
      customer_name: 'Integration Test', customer_phone: '01711000999', address: 'House 1, Road 1, Test Area', district: 'Dhaka',
      zone_id: ZONE_OUTSIDE, discount: 0,
      items: [{ variant_id: V.maxiM, quantity: 1 }, { variant_id: V.maxiXL, quantity: 2, unit_price: 2000 }],
    };
    const { client: support } = await userClient('support');
    expect((await support.rpc('admin_save_order', { p_order_id: o!.id, p_payload: payload })).error?.message).toBe('FORBIDDEN');

    const { client: manager } = await userClient('manager');
    const { error } = await manager.rpc('admin_save_order', { p_order_id: o!.id, p_payload: payload });
    expect(error).toBeNull();
    expect(await stockOf(V.maxiM)).toBe(9);
    expect(await stockOf(V.maxiXL)).toBe(8);
    const { data: after } = await service().from('orders').select('subtotal, delivery_charge, total').eq('id', o!.id).single();
    expect(Number(after!.subtotal)).toBe(2450 + 4000);
    expect(Number(after!.delivery_charge)).toBe(130);

    await service().from('orders').delete().eq('id', o!.id);
  });

  it('a blocked number cannot place an order', async () => {
    const phone = `018${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    await service().from('blocked_phones').insert({ phone, reason: 'integration test' });
    const r = await service().rpc('place_order', { p_payload: orderPayload([{ variant_id: V.scarf, quantity: 1 }], { customer_phone: phone, idempotency_key: randomUUID() }) });
    expect(r.error?.message).toBe('BLOCKED');
    await service().from('blocked_phones').delete().eq('phone', phone);
  });
});
