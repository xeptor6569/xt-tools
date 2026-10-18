import { describe, expect, it } from 'vitest';
import { CsvError, csvToObjects, detectDelimiter, objectsToRows, parseCsv, writeCsv } from '../../src/lib/csv.ts';

describe('csv', () => {
  it('parses quoted fields, escaped quotes, newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n"multi\nline",2\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', '2'],
    ]);
  });

  it('keeps empty fields and handles a missing final newline', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('detects the delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('a,b\n1,2')).toBe(',');
    expect(detectDelimiter('single')).toBe(',');
  });

  it('round-trips', () => {
    const rows = [
      ['name', 'note'],
      ['Ada', 'said "hi", left'],
      ['Bob', 'line\nbreak'],
      [' pad', ''],
    ];
    expect(parseCsv(writeCsv(rows), ',')).toEqual(rows);
  });

  it('converts to and from objects', () => {
    expect(csvToObjects('name,age\nAda,36\n\nBob,')).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Bob', age: '' },
    ]);
    expect(objectsToRows([{ a: 1 }, { b: { c: 2 } }])).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['', '{"c":2}'],
    ]);
  });

  it('reports unclosed quotes', () => {
    expect(() => parseCsv('"open')).toThrow(CsvError);
  });
});
