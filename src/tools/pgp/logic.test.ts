import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { generatePgpKeyPair, pgp } from './logic.ts';

describe('pgp', () => {
  it('decrypts a known symmetrically encrypted OpenPGP message', async () => {
    const armored = [
      'passphrase: correct-horse',
      '-----BEGIN PGP MESSAGE-----',
      '',
      'wy4ECQMIyEWsXbueNK/gLUNiHu/TyuHpjRVjxvygTd5QTmiPBptZ0MD7VWM1',
      'pXAi0j4B2aKrCQ4Zt8IRkUjxbBSln6eSPscq6qKPqxR9CO39i5IbIJ3gWMbe',
      'yfR/A0CU5TbGdxxkzBLtEBPx72Bjhw==',
      '=4BnO',
      '-----END PGP MESSAGE-----',
    ].join('\n');
    expect(await pgp(armored)).toBe('hello openpgp');
  });

  it('encrypts and decrypts symmetrically with a passphrase', async () => {
    const cipher = await pgp('passphrase: my-secret\nsecret message');
    expect(cipher).toContain('-----BEGIN PGP MESSAGE-----');
    const plain = await pgp(cipher, { passphrase: 'my-secret' });
    expect(plain).toBe('secret message');
  });

  it('generates a key pair, inspects it, and encrypts/decrypts and signs/verifies', async () => {
    const keys = await generatePgpKeyPair('Alice Test', 'alice@example.com');
    expect(keys.fingerprint).toMatch(/^[0-9A-F]{40}$/);

    const info = await pgp(keys.publicKey);
    expect(info).toContain(`fingerprint: ${keys.fingerprint}`);
    expect(info).toContain('Alice Test <alice@example.com>');

    const encrypted = await pgp('confidential payload', { mode: 'encrypt', publicKey: keys.publicKey });
    expect(encrypted).toContain('-----BEGIN PGP MESSAGE-----');
    const decrypted = await pgp(encrypted, { mode: 'decrypt', privateKey: keys.privateKey });
    expect(decrypted).toBe('confidential payload');

    const signed = await pgp('authenticated statement', { mode: 'sign', privateKey: keys.privateKey });
    expect(signed).toContain('-----BEGIN PGP SIGNED MESSAGE-----');
    const verified = await pgp(signed, { mode: 'verify', publicKey: keys.publicKey });
    expect(verified).toContain('status: valid signature');
    expect(verified).toContain('message: authenticated statement');
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => pgp(input, { passphrase: 'test-password' }), {
      timeLimitMs: 5000,
    });
  });
});
