import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { exifViewer, formatExif, NO_EXIF } from './logic.ts';
import meta from './meta.ts';

describe('exifViewer', () => {
  it('lists tags as text, sorted by name', () => {
    expect(exifViewer('{"Make":"Canon","Model":"AE-1"}')).toBe('Make: Canon\nModel: AE-1');
    expect(formatExif({ b: 1, a: 2 })).toBe('a: 2\nb: 1');
  });

  it('prints GPS numbers without building a map link', () => {
    const text = formatExif({ latitude: 51.5, longitude: -0.12 });
    expect(text).toContain('latitude: 51.500000');
    expect(text).toContain('longitude: -0.120000');
    expect(text).not.toContain('http');
  });

  it('says when there is no EXIF and skips binary blobs', () => {
    expect(exifViewer('{}')).toBe(NO_EXIF);
    expect(exifViewer('null')).toBe(NO_EXIF);
    expect(formatExif({ makerNote: new Uint8Array([1, 2, 3]), Make: 'Canon' })).toBe('Make: Canon');
  });

  it('rejects JSON that is not an object', () => {
    expect(() => exifViewer('hello')).toThrow(ToolInputError);
    expect(() => exifViewer('[1]')).toThrow(ToolInputError);
    expect(exifViewer('')).toBe('');
  });

  it('loads the exif parser', async () => {
    const mod = (await import('exifr')) as { parse?: unknown; default?: { parse?: unknown } };
    expect(typeof (mod.parse ?? mod.default?.parse)).toBe('function');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(exifViewer(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(exifViewer);
  });
});
