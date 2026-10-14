import { describe, expect, it } from 'vitest';
import { validateMeta } from '../../src/tools/validate-meta.ts';

const valid = {
  id: 'demo-tool',
  name: 'Demo tool',
  description: 'Demo tool used to prove the scaffolding loop.',
  category: 'text',
  keywords: ['demo'],
  added: '2026-01-01',
};

describe('validateMeta', () => {
  it('accepts valid metadata', () => {
    expect(validateMeta(valid, 'demo-tool')).toEqual([]);
  });

  it.each([
    [{ id: 'Bad_Id' }, /kebab-case/],
    [{ id: 'other' }, /does not match folder/],
    [{ name: 'x' }, /name must be 2–40/],
    [{ description: 'Too short.' }, /20–160/],
    [{ description: 'No period at the end of this description' }, /ending with a period/],
    [{ description: 'First sentence here. Second sentence too.' }, /single sentence/],
    [{ category: 'nope' }, /category must be one of/],
    [{ keywords: [] }, /non-empty array/],
    [{ keywords: ['Upper'] }, /lowercase/],
    [{ keywords: ['a', 'a'] }, /duplicated/],
    [{ added: '2026-13-45' }, /ISO date/],
    [{ added: '2999-01-01' }, /future/],
    [{ requires: ['telepathy'] }, /unknown capability/],
    [{ sensitive: 'yes' }, /boolean/],
    [{ examples: [{ input: 'x' }] }, /examples\[0\]/],
    [{ extra: true }, /unknown field/],
  ])('rejects %j', (patch, message) => {
    const problems = validateMeta({ ...valid, ...patch }, 'demo-tool');
    expect(problems.join('\n')).toMatch(message);
  });

  it('rejects non-objects', () => {
    expect(validateMeta(null)).toEqual(['metadata must be an object']);
  });
});
