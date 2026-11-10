import { webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type * as OpenPgp from 'openpgp';
import { patchOpenPgpPlainHttp } from './openpgp-plain-http.ts';

const ARMORED = [
  '-----BEGIN PGP MESSAGE-----',
  '',
  'wy4ECQMIyEWsXbueNK/gLUNiHu/TyuHpjRVjxvygTd5QTmiPBptZ0MD7VWM1',
  'pXAi0j4B2aKrCQ4Zt8IRkUjxbBSln6eSPscq6qKPqxR9CO39i5IbIJ3gWMbe',
  'yfR/A0CU5TbGdxxkzBLtEBPx72Bjhw==',
  '=4BnO',
  '-----END PGP MESSAGE-----',
].join('\n');

describe('openpgp plain-http patch', () => {
  it('decrypts and generates a Curve25519 key without WebCrypto', async () => {
    const raw = readFileSync(new URL('../../node_modules/openpgp/dist/openpgp.min.mjs', import.meta.url), 'utf8');
    const patched = patchOpenPgpPlainHttp(raw).replace(/\n\/\/# sourceMappingURL=.*$/s, '\n');
    expect(patched).not.toContain('The WebCrypto API is not available');
    expect(patched).toContain('throw{name:"NotSupportedError"}');

    const dir = mkdtempSync(join(tmpdir(), 'xt-openpgp-'));
    const file = join(dir, 'openpgp.mjs');
    writeFileSync(file, patched);

    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => {
          webcrypto.getRandomValues(bytes as unknown as Uint8Array<ArrayBuffer>);
          return bytes;
        },
      },
    });
    try {
      const openpgp = (await import(pathToFileURL(file).href)) as typeof OpenPgp;
      const message = await openpgp.readMessage({ armoredMessage: ARMORED });
      const decrypted = await openpgp.decrypt({ message, passwords: ['correct-horse'], format: 'utf8' });
      expect(decrypted.data).toBe('hello openpgp');

      const { publicKey, privateKey } = await openpgp.generateKey({
        type: 'ecc',
        curve: 'curve25519Legacy',
        userIDs: [{ name: 'Plain HTTP' }],
        format: 'armored',
      });
      expect(publicKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      expect(privateKey).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');

      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: 'plain http' }),
        encryptionKeys: await openpgp.readKey({ armoredKey: publicKey }),
        format: 'armored',
      });
      const clear = await openpgp.decrypt({
        message: await openpgp.readMessage({ armoredMessage: String(encrypted) }),
        decryptionKeys: await openpgp.readPrivateKey({ armoredKey: privateKey }),
        format: 'utf8',
      });
      expect(clear.data).toBe('plain http');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original });
    }
  }, 30_000);

  it('patches the unminified bundle the same way', () => {
    const raw = readFileSync(new URL('../../node_modules/openpgp/dist/openpgp.mjs', import.meta.url), 'utf8');
    const patched = patchOpenPgpPlainHttp(raw);
    expect(patched).not.toContain('The WebCrypto API is not available');
    expect(patched).toContain("missing.name = 'NotSupportedError'");
  });
});
