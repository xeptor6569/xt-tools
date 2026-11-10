import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { passwordHash } from './logic.ts';

describe('passwordHash', () => {
  it('hashes and verifies with Argon2id, Argon2i and Argon2d', async () => {
    const out = await passwordHash(
      'algo: argon2id\nmemory: 512\niterations: 2\nparallelism: 1\nsalt: ssssssss\npassword',
    );
    expect(out).toContain('$argon2id$v=19$m=512,t=2,p=1$c3Nzc3Nzc3M$wdYS1hpl9YPIOBSn0hQMNZsUDI/qSzYunFl8YbtZmZI');
    expect(out).toContain('hex: c1d612d61a65f583c83814a7d2140c359b140c8fea4b362e9c597c61bb599992');

    const line = out.split('\n')[0]!;
    expect(await passwordHash(`mode: verify\nhash: ${line}\npassword`)).toBe('match');
    expect(await passwordHash(`mode: verify\nhash: ${line}\nwrong`)).toBe('mismatch');

    const iOut = await passwordHash('algo: argon2i\nmemory: 256\niterations: 1\nsalt: 12345678\nsecret');
    expect(iOut).toMatch(/^\$argon2i\$v=19\$m=256,t=1,p=1\$/);
    expect(await passwordHash(`mode: verify\nhash: ${iOut.split('\n')[0]!}\nsecret`)).toBe('match');

    const dOut = await passwordHash('algo: argon2d\nmemory: 256\niterations: 1\nsalt: 12345678\nsecret');
    expect(dOut).toMatch(/^\$argon2d\$v=19\$m=256,t=1,p=1\$/);
    expect(await passwordHash(`mode: verify\nhash: ${dOut.split('\n')[0]!}\nsecret`)).toBe('match');
  });

  it('derives and verifies scrypt PHC hashes', async () => {
    const out = await passwordHash('algo: scrypt\ncost: 1024\nr: 8\np: 1\nsalt: NaClSalt\npassword');
    const phc = out.split('\n')[0]!;
    expect(phc).toMatch(/^\$scrypt\$ln=10,r=8,p=1\$/);
    expect(await passwordHash(`mode: verify\nhash: ${phc}\npassword`)).toBe('match');
    expect(await passwordHash(`mode: verify\nhash: ${phc}\nother`)).toBe('mismatch');
  });

  it('matches Node crypto.pbkdf2Sync and verifies PBKDF2 PHC strings', async () => {
    const out = await passwordHash('algo: pbkdf2-sha256\niterations: 1000\nsalt: saltSALT\npassword');
    const oracle = pbkdf2Sync('password', 'saltSALT', 1000, 32, 'sha256').toString('hex');
    const phc = out.split('\n')[0]!;
    expect(phc).toMatch(/^\$pbkdf2-sha256\$i=1000\$/);
    expect(out).toContain(`hex: ${oracle}`);
    expect(await passwordHash(`mode: verify\nhash: ${phc}\npassword`)).toBe('match');
    expect(await passwordHash(`mode: verify\nhash: ${phc}\nwrong`)).toBe('mismatch');
  });

  it('rejects non-power-of-two scrypt cost and malformed hashes', async () => {
    await expect(passwordHash('algo: scrypt\ncost: 1000\nsalt: 12345678\npw')).rejects.toThrow(/power of two/);
    await expect(passwordHash('mode: verify\nhash: $unknown$abc\npw')).rejects.toThrow(/Paste a PHC hash/);
  });

  it('survives empty, huge and malformed input', async () => {
    const saltBytes = new Uint8Array(16).fill(7);
    await expectRobustAsync(
      (input) => passwordHash(input, { algo: 'argon2id', memory: 64, iterations: 1, saltBytes }),
      { timeLimitMs: 5000 },
    );
  });
});
