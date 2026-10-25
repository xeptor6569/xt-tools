import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { base64, base64urlnopad } from '@scure/base';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { sshEd25519, sshRsa, normalizeComment } from './logic.ts';

const RFC_SEED = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
const RFC_PUB = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';

function decodeB64(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  return base64.decode(`${text}${pad}`);
}

function sshBin(): string {
  return 'ssh-keygen';
}

describe('sshKeygen', () => {
  it('builds an Ed25519 key ssh-keygen accepts', async () => {
    const text = await sshEd25519(RFC_SEED, 'xt@example');
    const [line, fpLine] = text.split('\n');
    expect(line).toMatch(/^ssh-ed25519 \S+ xt@example$/);
    expect(fpLine?.startsWith('SHA256:')).toBe(true);
    const wire = decodeB64(line!.split(' ')[1]!);
    expect(bytesToHex(wire.slice(-32))).toBe(RFC_PUB);

    const pem = text.slice(text.indexOf('-----BEGIN OPENSSH PRIVATE KEY-----'));
    const dir = mkdtempSync(join(tmpdir(), 'xt-ssh-'));
    const file = join(dir, 'id_ed25519');
    writeFileSync(file, pem.endsWith('\n') ? pem : `${pem}\n`);
    chmodSync(file, 0o600);
    const bin = sshBin();
    const derived = execFileSync(bin, ['-y', '-f', file], { encoding: 'utf8' }).trim();
    expect(derived).toBe(line);
    const listed = execFileSync(bin, ['-l', '-f', file], { encoding: 'utf8' });
    expect(listed).toContain(fpLine);
  });

  it('builds an RSA public key that matches the private PEM', async () => {
    const text = await sshRsa('rsa@xt', 2048);
    const [line, fpLine] = text.split('\n');
    expect(line).toMatch(/^ssh-rsa \S+ rsa@xt$/);
    expect(fpLine?.startsWith('SHA256:')).toBe(true);
    const pem = text.slice(text.indexOf('-----BEGIN PRIVATE KEY-----'));
    const jwk = createPublicKey(createPrivateKey(pem)).export({ format: 'jwk' });
    const n = base64urlnopad.decode(String(jwk.n));
    const wire = decodeB64(line!.split(' ')[1]!);
    expect(new TextDecoder().decode(wire.subarray(4, 11))).toBe('ssh-rsa');
    expect(bytesToHex(wire)).toContain(bytesToHex(n));
    const digest = createHash('sha256').update(wire).digest('base64').replace(/=+$/, '');
    expect(fpLine).toBe(`SHA256:${digest}`);
  });

  it('rejects a comment that spans lines', () => {
    expect(() => normalizeComment('a\nb')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed comments', () => {
    expectRobust(normalizeComment);
  });
});
