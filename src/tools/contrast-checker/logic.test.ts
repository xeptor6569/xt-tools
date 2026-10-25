import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { contrastChecker, contrastRatio, relativeLuminance } from './logic.ts';
import meta from './meta.ts';

describe('contrastChecker', () => {
  it('uses the WCAG relative-luminance ratio', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
  });

  it('reports AA and AAA for normal and large text', () => {
    const black = contrastChecker('#000000 #ffffff');
    expect(black).toContain('Contrast ratio: 21:1');
    expect(black).toContain('Normal text: AA pass, AAA pass');
    expect(black).toContain('Large text: AA pass, AAA pass');

    const gray = contrastChecker('#777777 #ffffff');
    expect(gray).toContain('Contrast ratio: 4.48:1');
    expect(gray).toContain('Normal text: AA fail, AAA fail');
    expect(gray).toContain('Large text: AA pass, AAA fail');
  });

  it('rejects a single color', () => {
    expect(() => contrastChecker('#ffffff')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(contrastChecker(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(contrastChecker, { malformed: ['#fff', 'black white', '#gggggg #ffffff'] });
  });
});
