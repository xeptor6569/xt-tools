import { describe, expect, it } from 'vitest';
import { categories } from '../categories.ts';
import {
  childCollections,
  createCollection,
  deleteCollection,
  MAX_PINS,
  newCollectionId,
  parsePinAttr,
  prunePins,
  renameCollection,
  sanitizeCollections,
  sanitizePins,
  togglePinList,
  toggleToolInCollection,
  type LibraryCatalog,
  type PersonalCollection,
} from './library.ts';
import { collectionChips, pinCards } from './library-view.ts';
import { groupTools } from './groups.ts';

const catalog: LibraryCatalog = {
  toolIds: ['slugify', 'json-format'],
  categoryIds: ['web', 'development'],
  groupIds: ['development/formatters'],
};

describe('pins', () => {
  it('parses pin attributes and ignores junk', () => {
    expect(parsePinAttr('tool:slugify')).toEqual({ kind: 'tool', id: 'slugify' });
    expect(parsePinAttr('group:development/formatters')).toEqual({
      kind: 'group',
      id: 'development/formatters',
    });
    expect(parsePinAttr('nope')).toBeUndefined();
    expect(parsePinAttr('color:red')).toBeUndefined();
  });

  it('keeps the newest pin first, drops duplicates and caps the list', () => {
    const first = togglePinList([], { kind: 'tool', id: 'slugify' });
    const second = togglePinList(first.pins, { kind: 'category', id: 'web' });
    expect(second.pins.map((pin) => pin.id)).toEqual(['web', 'slugify']);
    const removed = togglePinList(second.pins, { kind: 'tool', id: 'slugify' });
    expect(removed.added).toBe(false);
    expect(removed.pins).toEqual([{ kind: 'category', id: 'web' }]);

    const full = Array.from({ length: MAX_PINS }, (_, index) => ({
      kind: 'tool' as const,
      id: `tool-${index}`,
    }));
    expect(togglePinList(full, { kind: 'tool', id: 'extra' }).full).toBe(true);
  });

  it('sanitizes stored pins and prunes ones the catalog no longer has', () => {
    const pins = sanitizePins({
      pins: [
        { kind: 'tool', id: 'slugify' },
        { kind: 'tool', id: 'slugify' },
        { kind: 'nope', id: 'x' },
        { kind: 'collection', id: 'abcdef0123456789' },
        null,
      ],
    });
    expect(pins).toEqual([
      { kind: 'tool', id: 'slugify' },
      { kind: 'collection', id: 'abcdef0123456789' },
    ]);
    expect(prunePins(pins, catalog, []).map((pin) => pin.id)).toEqual(['slugify']);
  });
});

describe('collections', () => {
  it('creates a top-level collection and one level of sub-collections', () => {
    const created = createCollection([], '  Daily \n', null);
    expect(created.error).toBeUndefined();
    expect(created.id).toMatch(/^[a-f0-9]{16}$/);
    const nested = createCollection(created.collections, 'Encoders', created.id!);
    expect(nested.error).toBeUndefined();
    expect(childCollections(nested.collections, created.id!)).toHaveLength(1);
    const tooDeep = createCollection(nested.collections, 'Inner', nested.id!);
    expect(tooDeep.error).toMatch(/cannot contain/);
  });

  it('rejects empty names and renames in place', () => {
    const created = createCollection([], 'Daily', null);
    expect(createCollection(created.collections, '   ', null).error).toMatch(/Enter a name/);
    const renamed = renameCollection(created.collections, created.id!, 'Weekday');
    expect(renamed.collections[0]?.name).toBe('Weekday');
  });

  it('toggles tool membership and deletes sub-collections with their parent', () => {
    const parent = createCollection([], 'Daily', null);
    const child = createCollection(parent.collections, 'Encoders', parent.id!);
    const withTool = toggleToolInCollection(child.collections, child.id!, 'slugify');
    expect(withTool.added).toBe(true);
    const removed = toggleToolInCollection(withTool.collections, child.id!, 'slugify');
    expect(removed.collections.find((item) => item.id === child.id)?.toolIds).toEqual([]);

    const deleted = deleteCollection(withTool.collections, parent.id!);
    expect(deleted.removedIds).toEqual([parent.id, child.id]);
    expect(deleted.collections).toEqual([]);
  });

  it('drops broken records and unknown tools when a catalog is supplied', () => {
    const raw = {
      collections: [
        { id: 'aaaaaaaaaaaaaaaa', name: 'Keep', parentId: null, toolIds: ['slugify', 'missing', 'slugify'] },
        { id: 'bbbbbbbbbbbbbbbb', name: 'Orphan child', parentId: 'cccccccccccccccc', toolIds: [] },
        { id: 'not-an-id', name: 'Bad', parentId: null, toolIds: [] },
        { id: 'dddddddddddddddd', name: '   ', parentId: null, toolIds: [] },
      ],
    };
    const kept = sanitizeCollections(raw, new Set(['slugify']));
    expect(kept).toEqual([
      { id: 'aaaaaaaaaaaaaaaa', name: 'Keep', parentId: null, toolIds: ['slugify'] },
    ] satisfies PersonalCollection[]);
  });

  it('mints ids from crypto', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newCollectionId()));
    expect(ids.size).toBe(20);
  });
});

describe('views', () => {
  const tools = [
    {
      id: 'json-format',
      name: 'JSON formatter',
      description: 'Prettify JSON.',
      category: 'development',
      group: 'formatters',
    },
  ];

  it('describes each kind of pin', () => {
    const collections = [{ id: 'aaaaaaaaaaaaaaaa', name: 'Daily', parentId: null, toolIds: ['json-format'] }];
    const cards = pinCards(
      [
        { kind: 'tool', id: 'json-format' },
        { kind: 'group', id: 'development/formatters' },
        { kind: 'category', id: 'development' },
        { kind: 'collection', id: 'aaaaaaaaaaaaaaaa' },
        { kind: 'tool', id: 'gone' },
      ],
      tools,
      collections,
      (path) => `/${path}`,
    );
    expect(cards.map((card) => card.title)).toEqual(['JSON formatter', 'Formatters', 'Development', 'Daily']);
    expect(cards[1]?.href).toBe('/category/development/#formatters');
    expect(cards[3]?.href).toBe('/collections/#c-aaaaaaaaaaaaaaaa');
    expect(cards[0]?.unpinLabel).toBe('JSON formatter');
  });

  it('counts tools inside sub-collections on the home chips', () => {
    const collections = [
      { id: 'aaaaaaaaaaaaaaaa', name: 'Daily', parentId: null, toolIds: ['json-format'] },
      { id: 'bbbbbbbbbbbbbbbb', name: 'Encoders', parentId: 'aaaaaaaaaaaaaaaa', toolIds: ['slugify'] },
    ];
    expect(collectionChips(collections, (path) => `/${path}`)[0]?.detail).toBe('2 tools · 1 sub-collection');
  });
});

describe('groupTools', () => {
  it('keeps ungrouped categories as one section', () => {
    const web = categories.find((category) => category.id === 'web');
    expect(web).toBeDefined();
    const sections = groupTools(web!, [{ id: 'slugify', group: undefined }]);
    expect(sections).toEqual([{ tools: [{ id: 'slugify', group: undefined }] }]);
  });

  it('orders curated groups and parks unknown ones under Other', () => {
    const text = categories.find((category) => category.id === 'text');
    expect(text).toBeDefined();
    const sections = groupTools(text!, [
      { id: 'a', group: 'write' },
      { id: 'b', group: 'transform' },
      { id: 'c', group: 'nope' },
    ]);
    expect(sections.map((section) => section.id)).toEqual(['transform', 'write', 'other']);
    expect(sections[0]?.tools.map((tool) => tool.id)).toEqual(['b']);
    expect(sections[2]?.label).toBe('Other');
  });
});
