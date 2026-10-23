import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, orderPayload, service, setStock, stockOf, V, ZONE_OUTSIDE } from './helpers';

const placed: string[] = [];
async function place(payload: Record<string, unknown>) {
  const res = await service().rpc('place_order', { p_payload: payload, p_ip_hash: 'test' });
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  if (row?.public_ref) placed.push(row.public_ref);
  return { row: row as { public_ref: string; total: number; created: boolean } | undefined, error: res.error };
}

let originalXL = 0;
beforeAll(async () => {
  originalXL = await stockOf(V.maxiXL);
});
afterAll(async () => {
  await setStock(V.maxiXL, originalXL);
  if (placed.length) await service().from('orders').delete().in('public_ref', placed);
});

describe('place_order — prices come from the database', () => {
  it('ignores every price, subtotal and total in the payload', async () => {
    const { row, error } = await place(
      orderPayload([{ variant_id: V.scarf, quantity: 2, unit_price: 1, line_total: 1 } as never], {
        zone_id: ZONE_OUTSIDE,
        subtotal: 1,
        delivery_charge: 0,
        total: 1,
        discount: 9999,
      }),
    );
    expect(error).toBeNull();
    expect(Number(row!.total)).toBe(2 * 590 + 130);
    const { data } = await service().from('orders').select('subtotal, discount, delivery_charge, total').eq('public_ref', row!.public_ref).single();
    expect(Number(data!.subtotal)).toBe(1180);
    expect(Number(data!.discount)).toBe(0);
    expect(Number(data!.total)).toBe(1310);
  });

  it('refuses a draft product', async () => {
    const { error } = await place(orderPayload([{ variant_id: V.draft, quantity: 1 }]));
    expect(error?.message).toBe('OUT_OF_STOCK');
  });
});

describe('place_order — duplicates', () => {
  it('returns the same order for the same idempotency key, even in parallel', async () => {
    const payload = orderPayload([{ variant_id: V.scarf, quantity: 1 }]);
    const before = await stockOf(V.scarf);
    const results = await Promise.all(Array.from({ length: 8 }, () => place(payload)));
    const refs = new Set(results.map((r) => r.row?.public_ref));
    expect(refs.size).toBe(1);
    expect(results.filter((r) => r.row?.created).length).toBe(1);
    expect(await stockOf(V.scarf)).toBe(before - 1);
  });
});

describe('place_order — stock races', () => {
  it('sells the last 2 units to exactly 2 of 10 simultaneous buyers', async () => {
    await setStock(V.maxiXL, 2);
    const results = await Promise.all(Array.from({ length: 10 }, () => place(orderPayload([{ variant_id: V.maxiXL, quantity: 1 }]))));
    const ok = results.filter((r) => r.row?.created);
    const refused = results.filter((r) => r.error?.message === 'OUT_OF_STOCK');
    expect(ok.length).toBe(2);
    expect(refused.length).toBe(8);
    expect(await stockOf(V.maxiXL)).toBe(0);
  });
});

describe('API access for visitors', () => {
  it('anon cannot call place_order, track_order or hit_rate_limit', async () => {
    const a = anon();
    for (const [fn, args] of [
      ['place_order', { p_payload: orderPayload([{ variant_id: V.scarf, quantity: 1 }]) }],
      ['track_order', { p_ref: 'SD-0000-0000', p_phone_last4: '1234' }],
      ['hit_rate_limit', { p_bucket: 'x', p_max_hits: 1, p_window_seconds: 60 }],
    ] as const) {
      const { error } = await a.rpc(fn, args);
      expect(error).not.toBeNull();
    }
  });

  it('anon cannot read or write orders', async () => {
    const a = anon();
    const read = await a.from('orders').select('id').limit(1);
    expect(read.error?.code).toBe('42501');
    const write = await a.from('orders').insert({ public_ref: 'XX-0000-0000', idempotency_key: randomUUID() });
    expect(write.error).not.toBeNull();
  });

  it('anon sees only published products', async () => {
    const { data } = await anon().from('products').select('slug');
    expect((data ?? []).map((p) => p.slug)).not.toContain('draft-sample-top');
  });

  it('anon can get a server price quote', async () => {
    const { data, error } = await anon().rpc('quote_order', { p_items: [{ variant_id: V.scarf, quantity: 2 }], p_zone_id: ZONE_OUTSIDE });
    expect(error).toBeNull();
    expect(Number(data.total)).toBe(1310);
  });
});
