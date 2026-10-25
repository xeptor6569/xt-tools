import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { socialPreview } from './logic.ts';
import meta from './meta.ts';

describe('socialPreview', () => {
  it('splits title and description and escapes the card', () => {
    const card = socialPreview('Hello | A short <description>');
    expect(card.text).toBe('Title: Hello\nDescription: A short <description>');
    expect(card.html).toBe('<article><h2>Hello</h2><p>A short &lt;description&gt;</p></article>');
    expect(card.html).not.toContain('<img');
  });

  it('treats a value with no bar as the title', () => {
    expect(socialPreview('Only a title').text).toBe('Title: Only a title\nDescription: ');
    expect(socialPreview('').text).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(socialPreview(example.input).text).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => socialPreview(input).text);
  });
});
