import { format, supportedDialects } from 'sql-formatter';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { DIALECTS, formatSql, type SqlFormatOptions } from './logic.ts';
import meta from './meta.ts';

const fmt = (input: string, options: SqlFormatOptions = {}) => formatSql(input, options, format);

describe('formatSql', () => {
  it('formats with upper-case keywords and two spaces by default', () => {
    expect(fmt('select id,name from users where id=1')).toBe('SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  id = 1');
  });

  it('keeps strings and comments exactly', () => {
    expect(fmt("select 'a''b  c' as \"Weird  Name\" -- keep me\nfrom t /* and me */")).toBe(
      "SELECT\n  'a''b  c' AS \"Weird  Name\" -- keep me\nFROM\n  t /* and me */",
    );
  });

  it('supports keyword, identifier, data type and function case', () => {
    expect(fmt('select cast(x as varchar) from t', { keywordCase: 'lower', identifierCase: 'upper' })).toBe(
      'select\n  cast(X as varchar)\nfrom\n  T',
    );
    expect(fmt('CREATE TABLE t (id int, n varchar(20))', { keywordCase: 'preserve', dataTypeCase: 'upper' })).toBe(
      'CREATE TABLE t (id INT, n VARCHAR(20))',
    );
    expect(fmt('select count(*) from t', { functionCase: 'upper' })).toBe('SELECT\n  COUNT(*)\nFROM\n  t');
  });

  it('supports four spaces, tabs and tabular styles', () => {
    expect(fmt('select a from t', { indent: '4' })).toBe('SELECT\n    a\nFROM\n    t');
    expect(fmt('select a from t', { indent: 'tab' })).toBe('SELECT\n\ta\nFROM\n\tt');
    expect(fmt('select a from t where b = 1', { indentStyle: 'tabularLeft' })).toBe(
      'SELECT    a\nFROM      t\nWHERE     b = 1',
    );
    expect(fmt('select a from t where b = 1', { indentStyle: 'tabularRight' })).toBe(
      '   SELECT a\n     FROM t\n    WHERE b = 1',
    );
  });

  it('places logical operators, dense operators and query spacing as asked', () => {
    expect(fmt('select a from t where a=1 and b=2', { logicalOperatorNewline: 'after', denseOperators: true })).toBe(
      'SELECT\n  a\nFROM\n  t\nWHERE\n  a=1 AND\n  b=2',
    );
    expect(fmt('select 1; select 2;', { linesBetweenQueries: 0 })).toBe('SELECT\n  1;\nSELECT\n  2;');
    expect(fmt('select 1; select 2;', { linesBetweenQueries: 2 })).toBe('SELECT\n  1;\n\n\nSELECT\n  2;');
    expect(fmt('select 1;', { newlineBeforeSemicolon: true })).toBe('SELECT\n  1\n;');
  });

  it('handles dialect-specific syntax', () => {
    expect(fmt('select [order] from [dbo].[t]', { dialect: 'transactsql' })).toBe(
      'SELECT\n  [order]\nFROM\n  [dbo].[t]',
    );
    expect(fmt('select `a` from `t` limit 1', { dialect: 'mysql' })).toBe('SELECT\n  `a`\nFROM\n  `t`\nLIMIT\n  1');
    expect(fmt('select $$x$$, $1::int', { dialect: 'postgresql' })).toBe('SELECT\n  $$x$$,\n  $1::int');
  });

  it('lists every dialect sql-formatter supports', () => {
    expect(DIALECTS.map((d) => d.value).sort()).toEqual(supportedDialects.filter((d) => d !== 'tsql').sort());
    for (const { value } of DIALECTS) expect(fmt('select a from t', { dialect: value })).toContain('FROM');
  });

  it('returns nothing for empty input', () => {
    expect(fmt('')).toBe('');
    expect(fmt(' \n\t ')).toBe('');
  });

  it('reports parse errors with line and column', () => {
    expect(() => fmt('select\n"unterminated')).toThrow(
      'Can’t parse this SQL at line 2, column 1: Unexpected text «"untermina». Picking the dialect of your database may help.',
    );
    expect(() => fmt('select * from (select', { dialect: 'postgresql' })).toThrow(
      'Can’t parse this SQL at line 1, column 22: The query ends too early.',
    );
    expect(() => fmt('select ' + '('.repeat(300) + '1' + ')'.repeat(300))).toThrow(/nested too deeply/);
  });

  it('rethrows configuration errors as bugs', () => {
    expect(() => formatSql('select 1', { dialect: 'nope' as 'sql' }, format)).toThrow(
      expect.not.objectContaining({ name: 'ToolInputError' }),
    );
  });

  it('turns a stack overflow into an input error', () => {
    const overflow = () => {
      throw new RangeError('Maximum call stack size exceeded');
    };
    expect(() => formatSql('select 1', {}, overflow)).toThrow(ToolInputError);
  });

  it('formats a long query quickly', () => {
    const query = 'SELECT u.id, COUNT(*) AS n FROM users u JOIN o ON o.uid = u.id WHERE x > 1 GROUP BY u.id; ';
    const big = query.repeat(1000);
    const start = performance.now();
    expect(fmt(big).split('SELECT')).toHaveLength(1001);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('runs the meta examples', () => {
    for (const { input, expect: expected } of meta.examples ?? []) expect(fmt(input)).toContain(expected);
  });

  it('survives empty, huge and malformed input', () => {
    const run = (input: string) => fmt(input);
    expectRobust(run, {
      malformed: [
        "'unterminated",
        '/* open comment',
        'select (((',
        ')))',
        'select a, '.repeat(20_000),
        '\u{1F680} \uD800 <script>alert(1)</script>',
        '$$',
        '`',
        '[',
      ],
    });
  });
});
