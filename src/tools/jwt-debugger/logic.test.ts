import { createSign, generateKeyPairSync } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/nist.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { base64urlnopad } from '@scure/base';
import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { jwtDebugger } from './logic.ts';

const JWT_IO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const NONE = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0In0.';

function b64url(bytes: Uint8Array): string {
  return base64urlnopad.encode(bytes);
}

describe('jwtDebugger', () => {
  it('decodes the jwt.io sample and verifies HS256', async () => {
    const decoded = await jwtDebugger(JWT_IO);
    expect(decoded).toContain('John Doe');
    expect(decoded).toContain('valid: not checked');
    expect(decoded).not.toContain('valid: yes');

    const verified = await jwtDebugger(`secret: your-256-bit-secret\n${JWT_IO}`);
    expect(verified).toContain('valid: yes');
    expect(verified).toContain('John Doe');

    const wrong = await jwtDebugger(`secret: other\n${JWT_IO}`);
    expect(wrong).toContain('valid: no');
    expect(wrong).not.toContain('valid: yes');
  });

  it('signs the jwt.io payload without re-stringifying it', async () => {
    const out = await jwtDebugger(
      'mode: sign\nalg: HS256\nsecret: your-256-bit-secret\n{"sub":"1234567890","name":"John Doe","iat":1516239022}',
    );
    expect(out).toContain('signature: SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(out).toContain(JWT_IO);
  });

  it('flags alg none and refuses to sign it', async () => {
    const out = await jwtDebugger(`secret: your-256-bit-secret\n${NONE}`);
    expect(out).toContain('unsafe');
    expect(out).toContain('valid: no');
    expect(out).not.toContain('valid: yes');
    expect(out).toContain('1234');
    await expect(jwtDebugger('mode: sign\nalg: NoNe\nsecret: x\n{"sub":"1"}')).rejects.toThrow(ToolInputError);
  });

  it('verifies Ed25519 (RFC 8032 test 1 public key)', async () => {
    const seed = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const publicKey = ed25519.getPublicKey(seed);
    expect(bytesToHex(publicKey)).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    const h = b64url(new TextEncoder().encode('{"alg":"EdDSA","typ":"JWT"}'));
    const p = b64url(new TextEncoder().encode('{"sub":"1234"}'));
    const sig = ed25519.sign(new TextEncoder().encode(`${h}.${p}`), seed);
    const token = `${h}.${p}.${b64url(sig)}`;
    const jwk = JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: b64url(publicKey) });
    const out = await jwtDebugger(`${jwk}\n${token}`);
    expect(out).toContain('valid: yes');
    const tampered = await jwtDebugger(`${jwk}\n${token.slice(0, -2)}aa`);
    expect(tampered).toContain('valid: no');
  });

  it('verifies ES256 with a P-256 JWK', async () => {
    const seed = new Uint8Array(48);
    seed[0] = 7;
    const { secretKey, publicKey } = p256.keygen(seed);
    const point = publicKey[0] === 4 ? publicKey : p256.getPublicKey(secretKey, false);
    const h = b64url(new TextEncoder().encode('{"alg":"ES256","typ":"JWT"}'));
    const p = b64url(new TextEncoder().encode('{"sub":"ec"}'));
    const sig = p256.sign(new TextEncoder().encode(`${h}.${p}`), secretKey, { prehash: true });
    const token = `${h}.${p}.${b64url(sig)}`;
    const jwk = JSON.stringify({
      kty: 'EC',
      crv: 'P-256',
      x: b64url(point.slice(1, 33)),
      y: b64url(point.slice(33)),
    });
    expect(await jwtDebugger(`${jwk}\n${token}`)).toContain('valid: yes');
  });

  it('verifies RS256 with a PEM public key (PKCS#1 v1.5)', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const h = b64url(Buffer.from('{"alg":"RS256","typ":"JWT"}'));
    const p = b64url(Buffer.from('{"sub":"rsa-vector"}'));
    const data = `${h}.${p}`;
    const sig = createSign('RSA-SHA256').update(data).end().sign(privateKey);
    const token = `${data}.${b64url(sig)}`;
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const out = await jwtDebugger(`${pem}\n${token}`);
    expect(out).toContain('valid: yes');
    expect(out).toContain('rsa-vector');
    const broken = `${h}.${b64url(Buffer.from('{"sub":"other"}'))}.${b64url(sig)}`;
    expect(await jwtDebugger(`${pem}\n${broken}`)).toContain('valid: no');
  });

  it('returns nothing for an empty box', async () => {
    expect(await jwtDebugger('')).toBe('');
    expect(await jwtDebugger(' \n ')).toBe('');
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync(jwtDebugger);
  });
});
