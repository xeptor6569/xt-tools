import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { extensionFor, pickVideoMime, screenRecorder } from './logic.ts';
import meta from './meta.ts';

describe('screenRecorder', () => {
  it('builds a safe file name', () => {
    expect(screenRecorder('')).toBe('screen.webm');
    expect(screenRecorder('demo')).toBe('demo.webm');
    expect(screenRecorder('My Clip!')).toBe('My-Clip.webm');
  });

  it('picks the first supported video type', () => {
    expect(pickVideoMime((mime) => mime === 'video/webm')).toBe('video/webm');
    expect(pickVideoMime(() => false)).toBe('video/webm');
    expect(extensionFor('video/mp4')).toBe('mp4');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(screenRecorder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(screenRecorder);
  });
});
