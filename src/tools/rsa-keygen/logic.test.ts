import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { copyBytes, decodePem } from '../x509-decoder/der.ts';
import { ToolInputError } from '../types.ts';
import { generateRsa, parseBits } from './logic.ts';

describe('rsa-keygen', () => {
  it('parses the bit size', () => {
    expect(parseBits('')).toBe(2048);
    expect(parseBits(' 4096 ')).toBe(4096);
    expect(() => parseBits('1024')).toThrow(ToolInputError);
    expect(() => parseBits('abc')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed size input', () => {
    expectRobust(parseBits);
  });

  it('generates a 2048-bit pair that can sign', async () => {
    const pem = await generateRsa(2048);
    expect(pem).toContain('BEGIN PUBLIC KEY');
    expect(pem).toContain('BEGIN PRIVATE KEY');
    const subtle = globalThis.crypto.subtle;
    const publicDer = decodePem(pem).der;
    const privatePem = pem.slice(pem.indexOf('-----BEGIN PRIVATE KEY-----'));
    const publicKey = await subtle.importKey(
      'spki',
      copyBytes(publicDer),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const privateKey = await subtle.importKey(
      'pkcs8',
      copyBytes(decodePem(privatePem).der),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const data = new TextEncoder().encode('xt-tools');
    const signature = await subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
    expect(await subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data)).toBe(true);
  });
});
