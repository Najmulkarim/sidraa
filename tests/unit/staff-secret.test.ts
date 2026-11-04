import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
beforeAll(() => { process.env.RATE_LIMIT_SALT ??= 'test-salt-0123456789abcdef0123456789'; });

describe('staff passwords', () => {
  it('locks and unlocks a password', async () => {
    const { openPassword, sealPassword } = await import('@/lib/staff-secret');
    const sealed = sealPassword('29XK4rTzb3Ap');
    expect(sealed).not.toContain('29XK4rTzb3Ap');
    expect(sealPassword('29XK4rTzb3Ap')).not.toBe(sealed); // a fresh random IV each time
    expect(openPassword(sealed)).toBe('29XK4rTzb3Ap');
  });
  it('refuses something changed or not ours', async () => {
    const { openPassword, sealPassword } = await import('@/lib/staff-secret');
    const sealed = sealPassword('secret-pass-1');
    const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(openPassword(tampered)).toBeNull();
    expect(openPassword('plain text')).toBeNull();
  });
});
