import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { codeMinifier } from './logic.ts';
import meta from './meta.ts';

describe('codeMinifier', () => {
  it('minifies HTML and drops comments', async () => {
    const text = await codeMinifier('html\n<p>Hello</p> <!-- note -->');
    expect(text).toContain('minified:\n<p>Hello</p>');
    expect(text).not.toContain('note');
    expect(text).toContain('<p>\n  Hello\n</p>');
  });

  it('treats a missing language line as HTML', async () => {
    const text = await codeMinifier('  <p>Hi</p>  ');
    expect(text).toContain('<p>Hi</p>');
  });

  it('minifies CSS without running it', async () => {
    const text = await codeMinifier('css\nbody { color: red; } /* note */');
    expect(text).toContain('body{color:red;}');
    expect(text).not.toContain('note');
    expect(text).toContain('body {\n  color: red;\n}');
  });

  it('strips JavaScript comments with the tokenizer and does not keep them', async () => {
    const text = await codeMinifier('js\nconst x = 1; // comment\nfunction f() { return x; }');
    expect(text).toContain('const x=1;');
    expect(text).toContain('function f(){return x;}');
    expect(text).not.toContain('comment');
    expect(text).toContain('function f(){');
  });

  it('rejects JavaScript that the tokenizer cannot read', async () => {
    await expect(codeMinifier('js\nfunction (')).rejects.toBeInstanceOf(ToolInputError);
  });

  it('returns nothing for an empty source', async () => {
    expect(await codeMinifier('')).toBe('');
    expect(await codeMinifier('js\n')).toBe('');
  });

  it('matches the published example', async () => {
    for (const example of meta.examples ?? []) expect(await codeMinifier(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync(codeMinifier);
  });
});
