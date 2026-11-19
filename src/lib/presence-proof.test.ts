import { describe, expect, it } from 'vitest';

import {
  generatePresenceSecret,
  parsePresenceQrPayload,
  presenceCommitment,
  presenceQrPayload,
} from './presence-proof';

describe('presence proof', () => {
  it('matches the known SHA-256 commitment', async () => {
    // SHA-256 of the bytes 0x00..0x0f.
    expect(
      await presenceCommitment('000102030405060708090a0b0c0d0e0f'),
    ).toBe('be45cb2605bf36bebde684841a28f0fd43c69850a3dce5fedba69928ee3a8991');
  });

  it('generates a fresh 16-byte secret whose commitment matches', async () => {
    const a = generatePresenceSecret();
    const b = generatePresenceSecret();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
    expect(await presenceCommitment(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips the patient QR payload', () => {
    const secret = generatePresenceSecret();
    const payload = presenceQrPayload('42', secret);
    expect(payload).not.toContain('http');
    expect(parsePresenceQrPayload(payload)).toEqual({
      voucherId: '42',
      secret,
    });
    expect(parsePresenceQrPayload('voucher 42')).toBeNull();
  });
});
