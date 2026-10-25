import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { passwordStrength } from './logic.ts';

describe('passwordStrength', () => {
  it('scores an empty password as 0 without loading a dictionary', async () => {
    expect(await passwordStrength('')).toContain('score: 0/4');
  });

  it('rates a common password as weak and a long passphrase higher', async () => {
    const weak = await passwordStrength('password');
    expect(weak).toContain('score: 0/4');
    expect(weak.toLowerCase()).toContain('common');
    const strong = await passwordStrength('correct horse battery staple');
    const score = Number(/^score: (\d)/m.exec(strong)?.[1]);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync(passwordStrength, { timeLimitMs: 5000 });
  });
});
