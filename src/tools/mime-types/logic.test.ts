import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { loadMimeDb, lookupMime, type MimeDb } from './logic.ts';
import meta from './meta.ts';

const fake: MimeDb = {
  'text/plain': { extensions: ['txt', 'text'] },
  'image/png': { extensions: ['png'] },
  'application/json': { extensions: ['json', 'map'] },
};

describe('mimeTypes', () => {
  it('maps an extension to a type and a type to extensions', () => {
    expect(lookupMime(fake, '.png')).toBe('image/png');
    expect(lookupMime(fake, 'png')).toBe('image/png');
    expect(lookupMime(fake, 'application/json')).toBe('.json, .map');
    expect(lookupMime(fake, 'nope')).toBe('No type matches ".nope".');
    expect(lookupMime(fake, '')).toBe('');
  });

  it('resolves png and json from mime-db', async () => {
    const db = await loadMimeDb();
    expect(lookupMime(db, '.png')).toBe('image/png');
    expect(lookupMime(db, 'application/json')).toContain('.json');
    expect(lookupMime(db, 'JSON')).toContain('application/json');
  });

  it('matches the published example', async () => {
    const db = await loadMimeDb();
    for (const example of meta.examples ?? []) expect(lookupMime(db, example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => lookupMime(fake, input));
  });
});
