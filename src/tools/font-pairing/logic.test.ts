import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { BUILT_IN_FAMILIES, fontPairing } from './logic.ts';
import meta from './meta.ts';

describe('fontPairing', () => {
  it('lists the requested families and the built-in fallback stack', () => {
    const output = fontPairing('Georgia | Palatino');
    expect(output).toContain('Heading: Georgia, Palatino, system-ui, sans-serif, monospace');
    expect(output).toContain('Body: Palatino, Georgia, system-ui, sans-serif, monospace');
    for (const family of BUILT_IN_FAMILIES) expect(output).toContain(family);
  });

  it('quotes a family that contains spaces and falls back when one name is missing', () => {
    expect(fontPairing('Times New Roman | system-ui')).toContain('Heading: "Times New Roman", Georgia');
    expect(fontPairing('Georgia')).toContain('Body: Palatino, Georgia, system-ui, sans-serif, monospace');
    expect(fontPairing('')).toContain('Georgia');
  });

  it('rejects CSS punctuation in a family name', () => {
    expect(() => fontPairing('Georgia; background | Palatino')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(fontPairing(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(fontPairing, { malformed: ['a | b | c', 'Georgia < Palatino', 'bad;name'] });
  });
});
