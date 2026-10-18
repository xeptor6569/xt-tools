import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { detect, FORMATS, parse, serialize } from './formats.ts';
import { dataFormatConverter } from './logic.ts';

const convert = (
  input: string,
  from: Parameters<typeof dataFormatConverter>[1],
  to: Parameters<typeof dataFormatConverter>[2],
) => dataFormatConverter(input, from, to).text;

const sample = { name: 'xt-tools', version: 1, tags: ['privacy', 'offline'], server: { port: 8080, tls: false } };

describe('data format converter', () => {
  it('JSON → YAML → JSON', () => {
    const yaml = convert(JSON.stringify(sample), 'json', 'yaml');
    expect(yaml).toBe(
      'name: xt-tools\nversion: 1\ntags:\n  - privacy\n  - offline\nserver:\n  port: 8080\n  tls: false',
    );
    expect(JSON.parse(convert(yaml, 'yaml', 'json'))).toEqual(sample);
  });

  it('JSON → TOML → JSON', () => {
    const toml = convert(JSON.stringify(sample), 'json', 'toml');
    expect(toml).toContain('[server]');
    expect(toml).toContain('tags = [ "privacy", "offline" ]');
    expect(JSON.parse(convert(toml, 'toml', 'json'))).toEqual(sample);
  });

  it('JSON → XML → JSON keeps structure', () => {
    const xml = convert(JSON.stringify({ config: sample }), 'json', 'xml');
    expect(xml).toContain('<config>');
    expect(xml).toContain('<port>8080</port>');
    expect(JSON.parse(convert(xml, 'xml', 'json'))).toEqual({ config: sample });
  });

  it('reads XML attributes', () => {
    expect(parse('<a id="1"><b>x</b></a>', 'xml')).toEqual({ a: { '@_id': '1', b: 'x' } });
  });

  it('CSV ⇄ JSON', () => {
    expect(JSON.parse(convert('name,age\nAda,36\nBob,41', 'csv', 'json'))).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Bob', age: '41' },
    ]);
    expect(convert('[{"a":1,"b":{"c":2}},{"a":3}]', 'json', 'csv')).toBe('a,b.c\n1,2\n3,');
  });

  it('.env ⇄ JSON', () => {
    const env = '# comment\nexport API_URL=http://localhost\nNAME="x t"\nEMPTY=\nSINGLE=\'a b\' \nTRAIL=value # note';
    expect(parse(env, 'env')).toEqual({
      API_URL: 'http://localhost',
      NAME: 'x t',
      EMPTY: '',
      SINGLE: 'a b',
      TRAIL: 'value',
    });
    expect(serialize({ db: { host: 'h', pass: 'p w' } }, 'env')).toBe('DB_HOST=h\nDB_PASS="p w"');
  });

  it('INI ⇄ JSON', () => {
    const ini = '; comment\nname = demo\n\n[server]\nport = 8080\nhost = "0.0.0.0"';
    expect(parse(ini, 'ini')).toEqual({ name: 'demo', server: { port: '8080', host: '0.0.0.0' } });
    expect(serialize({ name: 'demo', server: { port: 8080 } }, 'ini')).toBe('name = demo\n\n[server]\nport = 8080');
  });

  it('properties ⇄ JSON', () => {
    const props = '# c\na.b=1\nkey\\ with\\ space : value\nmulti = one \\\n    two\nuni=caf\\u00e9';
    expect(parse(props, 'properties')).toEqual({
      'a.b': '1',
      'key with space': 'value',
      multi: 'one two',
      uni: 'café',
    });
    expect(serialize({ app: { name: 'café', 'a=b': 'x' } }, 'properties')).toBe('app.name=caf\\u00e9\napp.a\\=b=x');
  });

  it('detects the input format', () => {
    expect(detect('{"a":1}')).toBe('json');
    expect(detect('<a/>')).toBe('xml');
    expect(detect('a: 1\nb: 2')).toBe('yaml');
    expect(detect('[s]\nk = "v"')).toBe('toml');
    expect(detect('[s]\nk = v')).toBe('ini');
    expect(detect('API_KEY=abc\nDEBUG=1')).toBe('env');
    expect(detect('a,b,c\n1,2,3')).toBe('csv');
  });

  it('reports invalid input with the format name', () => {
    expect(() => convert('{"a":', 'json', 'yaml')).toThrow(/Invalid JSON/);
    expect(() => convert('a: [1', 'yaml', 'json')).toThrow(/Invalid YAML/);
    expect(() => convert('a = ', 'toml', 'json')).toThrow(/Invalid TOML/);
    expect(() => convert('<a><b></a>', 'xml', 'json')).toThrow(/Invalid XML/);
    expect(() => convert('[1,2]', 'json', 'toml')).toThrow(ToolInputError);
    expect(() => convert('just text', 'env', 'json')).toThrow(/line 1/);
  });

  it('refuses YAML alias bombs', () => {
    const bomb =
      'a: &a [x,x,x,x,x,x,x,x,x]\n' +
      Array.from(
        { length: 9 },
        (_, i) =>
          `${String.fromCharCode(98 + i)}: &${String.fromCharCode(98 + i)} [${Array(9)
            .fill(`*${String.fromCharCode(97 + i)}`)
            .join(',')}]`,
      ).join('\n');
    expect(() => convert(bomb, 'yaml', 'json')).toThrow(ToolInputError);
  });

  it('every format round-trips a flat object', () => {
    const flat = { alpha: 'one', beta: 'two words' };
    for (const { value } of FORMATS) {
      if (value === 'csv') continue;
      const back = parse(serialize(flat, value), value);
      expect(value === 'xml' ? ((back as { root?: unknown }).root ?? back) : back, value).toMatchObject(
        value === 'env' ? { ALPHA: 'one', BETA: 'two words' } : flat,
      );
    }
  });

  it('survives empty, huge and malformed input', () => {
    for (const { value } of FORMATS) expectRobust((s) => dataFormatConverter(s, value, 'json'), { timeLimitMs: 5000 });
    expectRobust((s) => dataFormatConverter(s, 'auto', 'yaml'), { timeLimitMs: 5000 });
  });
});
