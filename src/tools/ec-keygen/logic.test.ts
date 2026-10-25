import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { copyBytes, decodePem } from '../x509-decoder/der.ts';
import { ecKeygen, normalizeComment } from './logic.ts';

const RFC_SEED = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');

describe('ecKeygen', () => {
  it('matches the RFC 8032 Ed25519 public key', async () => {
    const out = await ecKeygen(() => RFC_SEED, 'ed25519', 'hex');
    expect(out).toContain('private: 9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    expect(out).toContain('public: d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
  });

  it('exports an Ed25519 PEM that WebCrypto can sign with', async () => {
    const pem = await ecKeygen(() => RFC_SEED, 'ed25519', 'pem', 'device');
    expect(pem.startsWith('comment: device\n')).toBe(true);
    const privatePem = pem.slice(pem.indexOf('-----BEGIN PRIVATE KEY-----'), pem.indexOf('-----BEGIN PUBLIC KEY-----'));
    const publicPem = pem.slice(pem.indexOf('-----BEGIN PUBLIC KEY-----'));
    const subtle = globalThis.crypto.subtle;
    const privateKey = await subtle.importKey(
      'pkcs8',
      copyBytes(decodePem(privatePem).der),
      { name: 'Ed25519' },
      false,
      ['sign'],
    );
    const publicKey = await subtle.importKey('spki', copyBytes(decodePem(publicPem).der), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    const data = new TextEncoder().encode('xt-tools');
    const signature = await subtle.sign('Ed25519', privateKey, data);
    expect(await subtle.verify('Ed25519', publicKey, signature, data)).toBe(true);
  });

  it('exports a P-256 PEM that WebCrypto can sign with', async () => {
    const seed = new Uint8Array(48);
    seed[47] = 9;
    const pem = await ecKeygen(() => seed, 'p256', 'pem');
    expect(pem).toContain('BEGIN PRIVATE KEY');
    expect(pem).toContain('BEGIN PUBLIC KEY');
    const privatePem = pem.slice(0, pem.indexOf('-----BEGIN PUBLIC KEY-----'));
    const publicPem = pem.slice(pem.indexOf('-----BEGIN PUBLIC KEY-----'));
    const subtle = globalThis.crypto.subtle;
    const params = { name: 'ECDSA', namedCurve: 'P-256' } as const;
    const privateKey = await subtle.importKey('pkcs8', copyBytes(decodePem(privatePem).der), params, false, ['sign']);
    const publicKey = await subtle.importKey('spki', copyBytes(decodePem(publicPem).der), params, false, ['verify']);
    const data = new TextEncoder().encode('xt-tools');
    const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, data)).toBe(true);
  });

  it('rejects a bad comment and a short seed', async () => {
    expect(() => normalizeComment('a\nb')).toThrow(ToolInputError);
    await expect(ecKeygen(() => new Uint8Array(16), 'ed25519', 'hex')).rejects.toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed comments', () => {
    expectRobust(normalizeComment);
  });
});
