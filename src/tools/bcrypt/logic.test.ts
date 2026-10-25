import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { bcryptHash, encodeBcryptSalt } from './logic.ts';

describe('bcryptHash', () => {
  it('matches the jBCrypt test vectors', () => {
    expect(bcryptHash('mode: hash\nrounds: 6\nsalt: DCq7YPn5Rq63x1Lad4cll.\n')).toBe(
      '$2a$06$DCq7YPn5Rq63x1Lad4cll.TV4S6ytwfsfvkgY8jIucDrjc8deX1s.',
    );
    expect(bcryptHash('mode: compare\nhash: $2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i\nabc')).toBe(
      'match',
    );
    expect(bcryptHash('mode: compare\nhash: $2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i\nnope')).toBe(
      'mismatch',
    );
  });

  it('hashes with injected salt bytes at cost 4', () => {
    const salt = new Uint8Array(16).map((_, i) => i + 1);
    const hash = bcryptHash('password', salt, 4);
    expect(hash.startsWith('$2a$04$')).toBe(true);
    expect(bcryptHash(`mode: compare\nhash: ${hash}\npassword`)).toBe('match');
    expect(encodeBcryptSalt(salt)).toHaveLength(22);
  });

  it('caps the cost factor', () => {
    expect(() => bcryptHash('mode: hash\nrounds: 13\nsalt: DCq7YPn5Rq63x1Lad4cll.\nx')).toThrow(ToolInputError);
  });

  it('returns nothing for an empty box', () => {
    expect(bcryptHash('')).toBe('');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(bcryptHash);
  });
});
