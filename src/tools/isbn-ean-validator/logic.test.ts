import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ean13CheckDigit, isbn10CheckDigit, isbnEanValidator, upcACheckDigit } from './logic.ts';
import meta from './meta.ts';

describe('isbnEanValidator', () => {
  it('checks ISBN-13, ISBN-10, EAN-13 and UPC-A', () => {
    expect(ean13CheckDigit('978030640615')).toBe('7');
    expect(isbn10CheckDigit('030640615')).toBe('2');
    expect(ean13CheckDigit('400638133393')).toBe('1');
    expect(upcACheckDigit('03600029145')).toBe('2');
    expect(isbn10CheckDigit('080442957')).toBe('X');

    expect(isbnEanValidator('978-0-306-40615-7')).toContain('Type: ISBN-13 (EAN-13)');
    expect(isbnEanValidator('978-0-306-40615-7')).toContain('Status: valid');
    expect(isbnEanValidator('0-306-40615-2')).toContain('Type: ISBN-10');
    expect(isbnEanValidator('0-306-40615-2')).toContain('Calculated check digit: 2');
    expect(isbnEanValidator('080442957X')).toContain('Calculated check digit: X');
    expect(isbnEanValidator('080442957X')).toContain('Status: valid');
    expect(isbnEanValidator('4006381333931')).toContain('Type: EAN-13');
    expect(isbnEanValidator('4006381333931')).toContain('Status: valid');
    expect(isbnEanValidator('036000291452')).toContain('Type: UPC-A');
    expect(isbnEanValidator('036000291452')).toContain('Status: valid');
  });

  it('shows the calculated digit when the check digit is wrong', () => {
    const output = isbnEanValidator('9780306406158');
    expect(output).toContain('Status: invalid');
    expect(output).toContain('Check digit: 8');
    expect(output).toContain('Calculated check digit: 7');
  });

  it('rejects a code of the wrong length', () => {
    expect(() => isbnEanValidator('12345')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(isbnEanValidator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(isbnEanValidator, { malformed: ['978', 'ISBN', 'xxxxxxxxxxxx'] });
  });
});
