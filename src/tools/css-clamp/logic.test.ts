import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { cssClamp, fluidTerms } from './logic.ts';
import meta from './meta.ts';

describe('cssClamp', () => {
  it('interpolates between the two viewport widths', () => {
    const terms = fluidTerms(16, 24, 320, 1280);
    expect(terms.vw).toBeCloseTo((8 / 960) * 100, 8);
    expect(terms.intercept).toBeCloseTo(16 - (8 / 960) * 320, 8);
    expect(terms.intercept + (terms.vw / 100) * 320).toBeCloseTo(16, 8);
    expect(terms.intercept + (terms.vw / 100) * 1280).toBeCloseTo(24, 8);

    const exact = fluidTerms(16, 32, 400, 1200);
    expect(exact.vw).toBeCloseTo(2, 8);
    expect(exact.intercept).toBeCloseTo(8, 8);
  });

  it('prints clamp() and the preferred vw term', () => {
    expect(cssClamp('min 16 max 24 from 320 to 1280')).toBe(
      'clamp(16px, 13.3333px + 0.8333vw, 24px)\nPreferred: 0.8333vw + 13.3333px',
    );
    expect(cssClamp('min 16px max 32px from 400px to 1200px')).toBe(
      'clamp(16px, 8px + 2vw, 32px)\nPreferred: 2vw + 8px',
    );
  });

  it('rejects a zero viewport span', () => {
    expect(() => cssClamp('min 16 max 24 from 320 to 320')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(cssClamp(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(cssClamp, { malformed: ['min', '16 24', 'min -1 max 2 from 1 to 2'] });
  });
});
