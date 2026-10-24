import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { describePath, jsonQuery } from './logic.ts';
import meta from './meta.ts';

// The classic example document from Stefan Goessner's JSONPath article.
const STORE = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      {
        category: 'fiction',
        author: 'J. R. R. Tolkien',
        title: 'The Lord of the Rings',
        isbn: '0-395-19395-8',
        price: 22.99,
      },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
};
const DOC = JSON.stringify(STORE);
const books = STORE.store.book;

const values = (path: string, doc = DOC) => JSON.parse(jsonQuery(doc, path).text) as unknown[];

describe('jsonQuery: Goessner store vectors', () => {
  it('$.store.book[*].author: the authors of all books', () => {
    expect(values('$.store.book[*].author')).toEqual(books.map((b) => b.author));
  });

  it('$..author: all authors', () => {
    expect(values('$..author')).toEqual(books.map((b) => b.author));
  });

  it('$.store.*: everything in the store', () => {
    expect(values('$.store.*')).toEqual([books, STORE.store.bicycle]);
  });

  it('$.store..price: the price of everything', () => {
    expect(values('$.store..price')).toEqual([8.95, 12.99, 8.99, 22.99, 19.95]);
  });

  it('$..book[2]: the third book', () => {
    expect(values('$..book[2]')).toEqual([books[2]]);
  });

  it('$..book[-1:]: the last book', () => {
    expect(values('$..book[-1:]')).toEqual([books[3]]);
  });

  it('$..book[0,1] and $..book[:2]: the first two books', () => {
    expect(values('$..book[0,1]')).toEqual(books.slice(0, 2));
    expect(values('$..book[:2]')).toEqual(books.slice(0, 2));
  });

  it('$..book[?(@.isbn)]: books with an ISBN', () => {
    expect(values('$..book[?(@.isbn)]')).toEqual([books[2], books[3]]);
  });

  it('$.store.book[?(@.price < 10)]: books cheaper than 10', () => {
    expect(values('$.store.book[?(@.price < 10)]')).toEqual([books[0], books[2]]);
  });

  it('$..*: every member and element (27 values)', () => {
    expect(jsonQuery(DOC, '$..*').matches).toHaveLength(27);
  });
});

describe('jsonQuery: paths and output', () => {
  it('reports normalized paths and JSON Pointers', () => {
    const { matches } = jsonQuery(DOC, '$..book[?(@.price > 20)].title');
    expect(matches).toEqual([
      { path: "$['store']['book'][3]['title']", pointer: '/store/book/3/title', preview: '"The Lord of the Rings"' },
    ]);
  });

  it('escapes awkward keys and tells numeric keys from indexes', () => {
    const doc = JSON.stringify({ '0': { "it's": [1] }, 'a/b~c': true, 'new\nline': null });
    expect(jsonQuery(doc, '$..*').matches.map((m) => [m.path, m.pointer])).toEqual([
      ["$['0']", '/0'],
      ["$['a/b~c']", '/a~1b~0c'],
      ["$['new\\nline']", '/new\nline'],
      ["$['0']['it\\'s']", "/0/it's"],
      ["$['0']['it\\'s'][0]", "/0/it's/0"],
    ]);
    expect(describePath("$['x'][2]", { x: [0, 1, 2] })).toEqual({ path: "$['x'][2]", pointer: '/x/2' });
  });

  it('pretty-prints the matched values as a JSON array', () => {
    expect(jsonQuery('{"a":{"b":42}}', '$.a').text).toBe('[\n  {\n    "b": 42\n  }\n]');
    expect(jsonQuery('{"a":1}', '$.missing')).toEqual({ text: '[]', matches: [], truncated: false });
  });

  it('shortens long previews', () => {
    const [match] = jsonQuery(JSON.stringify({ s: 'x'.repeat(500) }), '$.s').matches;
    expect(match?.preview).toHaveLength(121);
    expect(match?.preview.endsWith('…')).toBe(true);
  });

  it('caps the number of results', () => {
    const doc = JSON.stringify(Array.from({ length: 50 }, (_, i) => i));
    const capped = jsonQuery(doc, '$[*]', 10);
    expect(capped.matches).toHaveLength(10);
    expect(capped.truncated).toBe(true);
    expect(JSON.parse(capped.text)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(jsonQuery(doc, '$[*]', 50).truncated).toBe(false);
  });

  it('caps the output size for queries that repeat large values', () => {
    const doc = JSON.stringify({ a: { b: { c: { d: 'x'.repeat(900_000) } } } });
    const result = jsonQuery(doc, '$..*');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(5_000_000);
  });

  it('matches the metadata examples with the default query', () => {
    for (const ex of meta.examples ?? []) expect(jsonQuery(ex.input, '$..*').text).toContain(ex.expect);
  });
});

describe('jsonQuery: errors and safety', () => {
  it('returns nothing for an empty document', () => {
    expect(jsonQuery('', '$..*')).toEqual({ text: '', matches: [], truncated: false });
  });

  it('reports invalid JSON and invalid expressions', () => {
    expect(() => jsonQuery('{"a":', '$')).toThrow(/Invalid JSON/);
    expect(() => jsonQuery(DOC, '$.store.book[?(@.price <)]')).toThrow(/Invalid JSONPath expression/);
    expect(() => jsonQuery(DOC, '$..book[?(@.x.y.z)]')).toThrow(/Invalid JSONPath expression: Cannot read/);
    expect(() => jsonQuery(DOC, '   ')).toThrow(/Enter a JSONPath expression/);
  });

  it('never runs code from filter expressions', () => {
    expect(() => jsonQuery(DOC, '$..book[?(@.author.constructor.constructor("return 1")())]')).toThrow(
      /Invalid JSONPath expression/,
    );
    expect(values('$.constructor')).toEqual([]);
    expect(values('$.__proto__')).toEqual([]);
  });

  it('survives empty, huge and malformed input', () => {
    const malformed = ['{"a":', '$[', '$..[?(@ =', '$[(@.length-1)]', '$..[?(@property.x.y)]', '$.a^^^~'];
    expectRobust((s) => jsonQuery(s, '$..*'), { malformed });
    expectRobust((s) => jsonQuery(DOC, s), { malformed });
  });
});
