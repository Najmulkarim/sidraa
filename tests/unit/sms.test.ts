import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));

describe('order SMS text', () => {
  it('fills in the words and leaves unknown ones', async () => {
    const { fillTemplate } = await import('@/lib/sms');
    expect(fillTemplate('Dear {name}, order {order} Tk {total}. {other}', { name: 'Rahima', order: 'SDR-0123', total: '1,250' }))
      .toBe('Dear Rahima, order SDR-0123 Tk 1,250. {other}');
  });
});
