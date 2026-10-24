import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { DRAFTS, detectFormats, draftFromUri, generateSchema, MAX_ERRORS, validateJson } from './logic.ts';
import meta from './meta.ts';

// $schema URIs, assembled so the test file reads like the real identifiers.
const ORG = 'https://json-schema.org';
const ORG_OLD = 'http://json-schema.org';

const PERSON = JSON.stringify({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'integer', minimum: 0 },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'age'],
});

describe('generateSchema', () => {
  it('infers types, required and nested properties', () => {
    expect(JSON.parse(generateSchema('{"name":"Ada","age":36,"admin":false,"score":1.5,"tags":["a"]}'))).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        admin: { type: 'boolean' },
        score: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'age', 'admin', 'score', 'tags'],
    });
  });

  it('pretty-prints with two spaces (the metadata examples)', () => {
    for (const ex of meta.examples ?? []) expect(generateSchema(ex.input)).toContain(ex.expect);
  });

  it('merges array elements: optional keys, null unions and integer/number widening', () => {
    const schema = JSON.parse(generateSchema('[{"id":1,"note":null},{"id":2.5,"note":"x","extra":{"a":true}}]'));
    expect(schema).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          note: { type: ['string', 'null'] },
          extra: { type: 'object', properties: { a: { type: 'boolean' } }, required: ['a'] },
        },
        required: ['id', 'note'],
      },
    });
  });

  it('supports required modes and additionalProperties: false', () => {
    const sample = '[{"a":1},{"a":2,"b":3}]';
    expect(JSON.parse(generateSchema(sample, { required: 'all' })).items.required).toEqual(['a', 'b']);
    expect(JSON.parse(generateSchema(sample, { required: 'none' })).items.required).toBeUndefined();
    expect(JSON.parse(generateSchema(sample, { noAdditional: true })).items.additionalProperties).toBe(false);
  });

  it('detects formats only when every string matches', () => {
    const schema = JSON.parse(
      generateSchema(
        JSON.stringify({
          at: '2024-05-01T12:00:00Z',
          on: '2024-05-01',
          mail: 'ada@example.com',
          id: '3f1c2a4e-9b7d-4c1e-8f2a-1b2c3d4e5f60',
          site: 'https://example.com/a',
          ip: '192.168.0.1',
          plain: 'hello',
          mixed: ['2024-05-01', 'soon'],
          badDate: '2024-02-30',
        }),
      ),
    );
    expect(schema.properties.at.format).toBe('date-time');
    expect(schema.properties.on.format).toBe('date');
    expect(schema.properties.mail.format).toBe('email');
    expect(schema.properties.id.format).toBe('uuid');
    expect(schema.properties.site.format).toBe('uri');
    expect(schema.properties.ip.format).toBe('ipv4');
    expect(schema.properties.plain.format).toBeUndefined();
    expect(schema.properties.mixed.items.format).toBeUndefined();
    expect(schema.properties.badDate.format).toBeUndefined();
    expect(JSON.parse(generateSchema('"2024-05-01"', { formats: false }))).toEqual({ type: 'string' });
  });

  it('handles empty arrays, null and scalars', () => {
    expect(JSON.parse(generateSchema('[]'))).toEqual({ type: 'array' });
    expect(JSON.parse(generateSchema('null'))).toEqual({ type: 'null' });
    expect(JSON.parse(generateSchema('[1,"a",null]'))).toEqual({
      type: 'array',
      items: { type: ['string', 'integer', 'null'] },
    });
  });

  it('produces schemas that accept their own sample', () => {
    const sample = '{"users":[{"id":1,"email":"a@b.co","since":"2024-01-01"},{"id":2,"nick":null}],"ok":true}';
    for (const draft of DRAFTS) {
      const schema = generateSchema(sample, { noAdditional: true });
      expect(validateJson(sample, schema, draft).valid).toBe(true);
    }
  });

  it('returns nothing for empty input and rejects invalid JSON', () => {
    expect(generateSchema('')).toBe('');
    expect(() => generateSchema('{"a":')).toThrow(/not valid JSON/);
    expect(() => generateSchema('['.repeat(1000) + ']'.repeat(1000))).toThrow(/nested too deeply/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(generateSchema, { malformed: ['{"a":', '[1,]', `"a@${'.'.repeat(100_000)} "`] });
  });
});

describe('detectFormats', () => {
  it('rejects look-alikes', () => {
    expect(detectFormats('256.1.1.1').has('ipv4')).toBe(false);
    expect(detectFormats('not an@email').has('email')).toBe(false);
    expect(detectFormats('2024-13-01').has('date')).toBe(false);
  });
});

describe('validateJson', () => {
  it('accepts a valid document', () => {
    const report = validateJson('{"name":"Ada","age":36,"email":"ada@example.com"}', PERSON);
    expect(report).toMatchObject({ valid: true, draft: '2020-12', fromSchema: false, errors: [], total: 0 });
  });

  it('reports every error with locations (no short-circuit)', () => {
    const report = validateJson('{"name":"","age":-1.5,"email":"nope"}', PERSON);
    expect(report.valid).toBe(false);
    const details = report.errors.filter((e) => !e.summary);
    expect(details.map((e) => [e.instance, e.keyword, e.schemaLocation])).toEqual([
      ['/name', 'minLength', '#/properties/name/minLength'],
      ['/age', 'type', '#/properties/age/type'],
      ['/age', 'minimum', '#/properties/age/minimum'],
      ['/email', 'format', '#/properties/email/format'],
    ]);
    expect(details[1]?.message).toBe('Instance type "number" is invalid. Expected "integer".');
    expect(report.errors.some((e) => e.summary)).toBe(true);
  });

  it('reports missing required properties at the root', () => {
    const report = validateJson('{}', PERSON);
    expect(report.errors.map((e) => [e.instance, e.keyword, e.message])).toEqual([
      ['', 'required', 'Instance does not have required property "name".'],
      ['', 'required', 'Instance does not have required property "age".'],
    ]);
  });

  it('reports additionalProperties: false once, with a useful message', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    });
    const report = validateJson('{"a":1,"b c":2}', schema);
    expect(report.errors.filter((e) => !e.summary).map((e) => [e.instance, e.keyword, e.message])).toEqual([
      ['/a', 'type', 'Instance type "number" is invalid. Expected "string".'],
      ['/b c', 'additionalProperties', 'Property "b c" is not allowed (additionalProperties is false).'],
    ]);
  });

  it('resolves $ref to $defs (2020-12) and definitions (draft 7)', () => {
    const modern = JSON.stringify({
      $schema: `${ORG}/draft/2020-12/schema`,
      type: 'array',
      items: { $ref: '#/$defs/tag' },
      $defs: { tag: { type: 'string', maxLength: 3 } },
    });
    expect(validateJson('["ab","abc"]', modern).valid).toBe(true);
    const bad = validateJson('["ab","abcd"]', modern);
    expect(bad.valid).toBe(false);
    expect(bad.errors.find((e) => !e.summary)).toMatchObject({
      instance: '/1',
      keyword: 'maxLength',
      schemaLocation: '#/items/$ref/maxLength',
    });

    const legacy = JSON.stringify({
      $schema: `${ORG_OLD}/draft-07/schema#`,
      properties: { tag: { $ref: '#/definitions/tag' } },
      definitions: { tag: { enum: ['a', 'b'] } },
    });
    expect(validateJson('{"tag":"a"}', legacy)).toMatchObject({ valid: true, draft: '7', fromSchema: true });
    expect(validateJson('{"tag":"c"}', legacy).valid).toBe(false);
  });

  it('resolves $id-relative references', () => {
    const schema = JSON.stringify({
      $id: 'https://example.com/root.json',
      $defs: { n: { $id: 'num.json', type: 'number' } },
      $ref: 'num.json',
    });
    expect(validateJson('5', schema).valid).toBe(true);
    expect(validateJson('"x"', schema).valid).toBe(false);
  });

  it('applies draft-specific rules', () => {
    // Tuple validation: `items` array (draft 7 and earlier) vs `prefixItems` (2020-12).
    const tuple7 = JSON.stringify({ items: [{ type: 'string' }], additionalItems: false });
    expect(validateJson('["a"]', tuple7, '7').valid).toBe(true);
    expect(validateJson('["a", 1]', tuple7, '7').valid).toBe(false);
    const tuple2020 = JSON.stringify({ prefixItems: [{ type: 'string' }], items: false });
    expect(validateJson('["a"]', tuple2020, '2020-12').valid).toBe(true);
    const extra = validateJson('["a", 1]', tuple2020, '2020-12');
    expect(extra.valid).toBe(false);
    expect(extra.errors.find((e) => !e.summary)).toMatchObject({ instance: '/1', keyword: 'items' });

    // Boolean exclusiveMaximum is draft 4; numeric exclusiveMaximum is draft 6+.
    expect(validateJson('5', JSON.stringify({ maximum: 5, exclusiveMaximum: true }), '4').valid).toBe(false);
    expect(validateJson('4', JSON.stringify({ maximum: 5, exclusiveMaximum: true }), '4').valid).toBe(true);
    expect(validateJson('5', JSON.stringify({ exclusiveMaximum: 5 }), '2019-09').valid).toBe(false);

    // dependentRequired is 2019-09+.
    const dep = JSON.stringify({ dependentRequired: { card: ['cvv'] } });
    expect(validateJson('{"card":1}', dep, '2019-09').valid).toBe(false);
    expect(validateJson('{"card":1,"cvv":2}', dep, '2019-09').valid).toBe(true);
  });

  it('honours $schema over the selected draft', () => {
    const schema = (uri: string) => JSON.stringify({ $schema: uri, type: 'string' });
    expect(validateJson('"x"', schema(`${ORG_OLD}/draft-04/schema#`), '2020-12')).toMatchObject({
      draft: '4',
      fromSchema: true,
    });
    expect(validateJson('"x"', schema(`${ORG}/draft/2019-09/schema`), '4').draft).toBe('2019-09');
    const six = validateJson('"x"', schema(`${ORG_OLD}/draft-06/schema#`));
    expect(six.draft).toBe('7');
    expect(six.notes[0]).toMatch(/Draft 6/);
    const unknown = validateJson('"x"', schema('urn:example:custom'), '2019-09');
    expect(unknown).toMatchObject({ draft: '2019-09', fromSchema: false });
    expect(unknown.notes[0]).toMatch(/Unrecognised \$schema/);
  });

  it('maps $schema URIs to drafts', () => {
    expect(draftFromUri(`${ORG}/draft/2020-12/schema`)?.draft).toBe('2020-12');
    expect(draftFromUri(`${ORG_OLD}/draft-07/schema`)?.draft).toBe('7');
    expect(draftFromUri(`${ORG_OLD}/draft-03/schema#`)).toBeUndefined();
  });

  it('accepts boolean schemas', () => {
    expect(validateJson('1', 'true').valid).toBe(true);
    expect(validateJson('1', 'false').valid).toBe(false);
  });

  it('caps the number of reported errors', () => {
    const many = JSON.stringify(Array.from({ length: 3000 }, (_, i) => i));
    const report = validateJson(many, '{"items":{"type":"string"}}');
    expect(report.errors).toHaveLength(MAX_ERRORS);
    expect(report.total).toBeGreaterThan(MAX_ERRORS);
  });

  it('explains bad input and broken schemas', () => {
    expect(() => validateJson('{}', '{"type":')).toThrow(/The schema is not valid JSON/);
    expect(() => validateJson('{', PERSON)).toThrow(/The JSON is not valid JSON/);
    expect(() => validateJson('{}', '[1]')).toThrow(/must be a JSON object/);
    expect(() => validateJson('', PERSON)).toThrow(/Enter the JSON/);
    expect(() => validateJson('{}', '')).toThrow(/Enter a schema/);
    expect(() => validateJson('1', '{"$ref":"#/nope"}')).toThrow(/Unresolved \$ref "#\/nope".*nothing is downloaded/);
    expect(() => validateJson('1', '{"$ref":"other.json"}')).toThrow(/Unresolved \$ref/);
    expect(() => validateJson('1', '{"$ref":"#"}')).toThrow(/recurses without end/);
    expect(() => validateJson('"x"', '{"pattern":"("}')).toThrow(/can't be applied/);
    expect(() => validateJson('"x"', '{"enum":3}')).toThrow(/can't be applied/);
    expect(() => validateJson('"x"', '{"$id":"http://[bad"}')).toThrow(/can't be applied/);
  });

  it('survives empty, huge and malformed input', () => {
    const malformed = ['{"a":', '[1,]', 'null', '{"$ref":"#"}', '{"enum":1}', '{"$id":"::"}', '{"\\ud800":1}'];
    expectRobust((s) => validateJson(s, PERSON), { malformed });
    expectRobust((s) => validateJson('{"a":1}', s), { malformed });
  });
});
