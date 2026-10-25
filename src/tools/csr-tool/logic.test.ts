import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { csrTool, generateCsr } from './logic.ts';

/** P-256 request generated locally with OpenSSL. Not fetched. */
export const SAMPLE_CSR = `-----BEGIN CERTIFICATE REQUEST-----
MIHoMIGQAgEAMC4xGTAXBgNVBAMMEHh0LXRvb2xzLmV4YW1wbGUxETAPBgNVBAoM
CHh0LXRvb2xzMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE5c89Kl6bYFnPMYf1
6zJKd4jydRj7400ALyG2rLrzPO85wTF5vx9uCJn4ss6VlVje04VPjW0SKSOXXDl2
81aVQKAAMAoGCCqGSM49BAMCA0cAMEQCIECCOs0L9dCc3mQKxZiEuDUXNr/56kZQ
dpMc66xwvIxUAiAj5FlpRued6AV/n78wH8HKZXG6BiM4bu8wVjDKZGp7AA==
-----END CERTIFICATE REQUEST-----`;

describe('csrTool', () => {
  it('reads the OpenSSL fixture', () => {
    const out = csrTool(SAMPLE_CSR);
    expect(out).toContain('subject: CN=xt-tools.example, O=xt-tools');
    expect(out).toContain('signatureAlgorithm: ecdsa-with-SHA256');
  });

  it('returns nothing until a PEM request is pasted', () => {
    expect(csrTool('')).toBe('');
    expect(csrTool('CN=example.com, O=Example')).toBe('');
    expect(() => csrTool('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(csrTool);
  });

  it('builds a request OpenSSL accepts', async () => {
    const pem = await generateCsr('CN=xt-tools.example, O=xt-tools');
    expect(csrTool(pem)).toContain('subject: CN=xt-tools.example, O=xt-tools');
    expect(csrTool(pem)).toContain('signatureAlgorithm: ecdsa-with-SHA256');
    const dir = mkdtempSync(join(tmpdir(), 'xt-csr-'));
    const file = join(dir, 'req.pem');
    writeFileSync(file, pem.endsWith('\n') ? pem : `${pem}\n`);
    const result = spawnSync('openssl', ['req', '-in', file, '-noout', '-verify', '-subject'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/verify OK/i);
    expect(`${result.stdout}\n${result.stderr}`).toContain('xt-tools.example');
  });

  it('rejects an empty subject', async () => {
    await expect(generateCsr('   ')).rejects.toThrow(ToolInputError);
  });
});
