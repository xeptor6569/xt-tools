import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { analyzeRange, compareVersions, incrementVersion, sortVersions, type ParseOptions } from './logic.ts';
import meta from './meta.ts';

const strict: ParseOptions = { loose: false, includePrerelease: false };
const sorted = (input: string, order: 'asc' | 'desc' = 'asc', options = strict) =>
  sortVersions(input, order, options).text;

describe('sortVersions', () => {
  it('sorts numerically, not lexically', () => {
    expect(sorted('1.10.0\n1.2.3\n1.2.10')).toBe('1.2.3\n1.2.10\n1.10.0');
    expect(sorted('1.10.0\n1.2.3\n1.2.10', 'desc')).toBe('1.10.0\n1.2.10\n1.2.3');
  });

  it('follows the precedence example from semver.org §11', () => {
    const order = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '2.0.0',
      '2.1.0',
      '2.1.1',
    ];
    expect(sorted([...order].reverse().join('\n'))).toBe(order.join('\n'));
  });

  it('keeps the original text, trims it and flags invalid lines', () => {
    const r = sortVersions('  v2.0.0 \n\nnot-a-version\n1.0.0+build.1\n1.2\n=1.0.0', 'asc', strict);
    expect(r.text).toBe('1.0.0+build.1\nv2.0.0');
    expect(r.versions.map((v) => v.version)).toEqual(['1.0.0', '2.0.0']);
    expect(r.invalid).toEqual([
      { line: 3, text: 'not-a-version' },
      { line: 5, text: '1.2' },
      { line: 6, text: '=1.0.0' },
    ]);
  });

  it('accepts sloppy versions in loose mode', () => {
    const r = sortVersions('=1.0.0\n1.2.3beta\n v0.1.0', 'asc', { loose: true, includePrerelease: false });
    expect(r.versions.map((v) => v.version)).toEqual(['0.1.0', '1.0.0', '1.2.3-beta']);
    expect(r.invalid).toEqual([]);
  });

  it('orders by build metadata as a tie-break, then by line', () => {
    expect(sorted('1.0.0+b\n1.0.0+a\n1.0.0')).toBe('1.0.0\n1.0.0+a\n1.0.0+b');
    expect(sorted('v1.0.0\n1.0.0')).toBe('v1.0.0\n1.0.0');
  });

  it('limits the input size', () => {
    expect(() => sortVersions('1.0.0\n'.repeat(10_001), 'asc', strict)).toThrow(/Too many lines/);
    expect(() => sortVersions('a'.repeat(1_000_001), 'asc', strict)).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    const malformed = [
      '1.2.3-',
      '1.2.3+',
      '01.2.3',
      '1.2.3-01',
      `1.2.${'9'.repeat(300)}`,
      '\n'.repeat(9999),
      '1.0.0\n'.repeat(9999),
    ];
    expectRobust((s) => sortVersions(s, 'asc', strict), { malformed });
    expectRobust((s) => sortVersions(s, 'desc', { loose: true, includePrerelease: true }), { malformed });
  });
});

describe('analyzeRange', () => {
  const list = sortVersions('1.1.0\n1.2.0\n1.9.9\n2.0.0\n2.1.0\n2.5.0-rc.1\n2.9.0\n3.0.0', 'asc', strict).versions;

  it('normalizes npm ranges like the semver package', () => {
    const norm = (range: string) => analyzeRange(range, [], strict)?.normalized;
    expect(norm('^1.2.3')).toBe('>=1.2.3 <2.0.0-0');
    expect(norm('~1.2.3')).toBe('>=1.2.3 <1.3.0-0');
    expect(norm('^0.2.3')).toBe('>=0.2.3 <0.3.0-0');
    expect(norm('1.x')).toBe('>=1.0.0 <2.0.0-0');
    expect(norm('1.2.3 - 2.3.4')).toBe('>=1.2.3 <=2.3.4');
    expect(norm('*')).toBe('*');
    expect(analyzeRange('   ', list, strict)).toBeNull();
  });

  it('finds the satisfying versions', () => {
    const r = analyzeRange('^1.2.0 || >=2.1.0 <3', list, strict)!;
    expect(r.alternatives).toEqual(['>=1.2.0 <2.0.0-0', '>=2.1.0 <3.0.0-0']);
    expect([...r.matching].map((line) => list.find((v) => v.line === line)!.text)).toEqual([
      '1.2.0',
      '1.9.9',
      '2.1.0',
      '2.9.0',
    ]);
    expect(r.maxSatisfying).toBe('2.9.0');
    expect(r.minSatisfying).toBe('1.2.0');
    expect(r.minVersion).toBe('1.2.0');
  });

  it('only matches prereleases on request', () => {
    expect(analyzeRange('>=2.1.0 <3', list, strict)!.matching.size).toBe(2);
    expect(analyzeRange('>=2.1.0 <3', list, { loose: false, includePrerelease: true })!.matching.size).toBe(3);
    expect(analyzeRange('>=2.5.0-rc.0 <3', list, strict)!.matching.size).toBe(2);
  });

  it('reports ranges that can never match', () => {
    const r = analyzeRange('>3 <2', list, strict)!;
    expect(r.matching.size).toBe(0);
    expect(r.minVersion).toBeNull();
    expect(r.maxSatisfying).toBeNull();
  });

  it('rejects invalid ranges', () => {
    expect(() => analyzeRange('^1.2.3 <<', list, strict)).toThrow(ToolInputError);
    expect(() => analyzeRange('hello', list, strict)).toThrow(/not a valid range/);
    expect(() => analyzeRange('1'.repeat(1001), list, strict)).toThrow(/too long/);
  });

  it('survives malformed ranges', () => {
    expectRobust((s) => analyzeRange(s.slice(0, 1000), list, strict), {
      malformed: ['||||', '>=', '^', '~>1', '1.2.3 - ', `${'>=1.0.0 '.repeat(120)}`, ' || '.repeat(240)],
    });
  });
});

describe('compareVersions', () => {
  it('compares and names the difference', () => {
    expect(compareVersions('1.2.3', '1.3.0', false)).toEqual({
      a: '1.2.3',
      b: '1.3.0',
      relation: '<',
      difference: 'minor',
      buildDiffers: false,
    });
    expect(compareVersions('2.0.0', '1.9.9', false)).toMatchObject({ relation: '>', difference: 'major' });
    expect(compareVersions('1.0.0', '1.0.1', false)).toMatchObject({ relation: '<', difference: 'patch' });
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta', false)).toMatchObject({ difference: 'prerelease' });
    expect(compareVersions('1.0.0-rc.1', '1.0.0', false)).toMatchObject({ relation: '<', difference: 'major' });
    expect(compareVersions('1.0.0+a', 'v1.0.0+b', false)).toMatchObject({
      relation: '=',
      difference: null,
      buildDiffers: true,
    });
    expect(compareVersions('', '1.0.0', false)).toBeNull();
    expect(() => compareVersions('1.0', '1.0.0', false)).toThrow(/Version A/);
    expect(() => compareVersions('1.0', '1.0.0', true)).toThrow(ToolInputError);
  });

  it('survives malformed input', () => {
    expectRobust((s) => compareVersions(s, '1.0.0', false));
    expectRobust((s) => compareVersions('1.0.0', s, true));
  });
});

describe('incrementVersion', () => {
  const values = (v: string, id = '') =>
    Object.fromEntries(incrementVersion(v, id, false)!.map((i) => [i.label, i.value]));

  it('lists every increment', () => {
    expect(values('1.2.3')).toEqual({
      'Next major': '2.0.0',
      'Next minor': '1.3.0',
      'Next patch': '1.2.4',
      'Pre-major': '2.0.0-0',
      'Pre-minor': '1.3.0-0',
      'Pre-patch': '1.2.4-0',
      'Next prerelease': '1.2.4-0',
    });
    expect(values('1.2.3', 'beta')).toMatchObject({ 'Pre-major': '2.0.0-beta.0', 'Next prerelease': '1.2.4-beta.0' });
    expect(values('1.2.3-beta.1', 'beta')).toMatchObject({
      'Next patch': '1.2.3',
      'Next prerelease': '1.2.3-beta.2',
      'Release (drop prerelease)': '1.2.3',
    });
    expect(values('2.0.0-rc.1')).toMatchObject({ 'Next major': '2.0.0', 'Next prerelease': '2.0.0-rc.2' });
  });

  it('validates its input', () => {
    expect(incrementVersion(' ', 'x', false)).toBeNull();
    expect(() => incrementVersion('nope', '', false)).toThrow(ToolInputError);
    expect(() => incrementVersion('1.0.0', 'bad id!', false)).toThrow(/letters, digits/);
  });

  it('survives malformed input', () => {
    expectRobust((s) => incrementVersion(s, 'rc', false));
    expectRobust((s) => incrementVersion('1.0.0', s, false));
  });
});

describe('meta examples', () => {
  it('produce the expected output', () => {
    for (const ex of meta.examples ?? []) expect(sorted(ex.input)).toContain(ex.expect);
  });
});
