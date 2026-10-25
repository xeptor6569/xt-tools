import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import meta from './meta.ts';
import { svgOptimizer } from './logic.ts';

const SAMPLE = `<?xml version="1.0"?>
<!-- note -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1">
  <sodipodi:namedview id="n"/>
  <metadata><rdf>inkscape</rdf></metadata>
  <rect width="10" height="10"/>
  <image href="https://example.com/a.png"/>
  <image href="data:image/png;base64,aaaa"/>
  <use href="#r"/>
</svg>`;

describe('svgOptimizer', () => {
  it('strips editor markup, comments and remote hrefs', () => {
    const out = svgOptimizer(SAMPLE);
    expect(out).not.toContain('<?xml');
    expect(out).not.toContain('note');
    expect(out).not.toContain('sodipodi');
    expect(out).not.toContain('inkscape');
    expect(out).not.toContain('example.com');
    expect(out).toContain('width="10"');
    expect(out).toContain('href="data:image/png;base64,aaaa"');
    expect(out).toContain('href="#r"');
    expect(out).toContain('><rect');
    expect(out.startsWith('<svg')).toBe(true);
  });

  it('keeps metadata that is not from an editor', () => {
    const out = svgOptimizer('<svg xmlns="http://www.w3.org/2000/svg"><metadata>title</metadata></svg>');
    expect(out).toContain('<metadata>title</metadata>');
  });

  it('rejects text that is not an SVG', () => {
    expect(() => svgOptimizer('hello')).toThrow(ToolInputError);
    expect(svgOptimizer('')).toBe('');
    expect(svgOptimizer('   ')).toBe('');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(svgOptimizer(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(svgOptimizer);
  });
});
