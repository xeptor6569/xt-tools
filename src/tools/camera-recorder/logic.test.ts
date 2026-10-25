import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { cameraRecorder, extensionFor, pickVideoMime } from './logic.ts';
import meta from './meta.ts';

describe('cameraRecorder', () => {
  it('builds a safe file name', () => {
    expect(cameraRecorder('')).toBe('camera.webm');
    expect(cameraRecorder('interview')).toBe('interview.webm');
    expect(cameraRecorder('My Clip!')).toBe('My-Clip.webm');
    expect(cameraRecorder('..')).toBe('camera.webm');
  });

  it('picks the first supported video type', () => {
    expect(pickVideoMime((mime) => mime === 'video/mp4')).toBe('video/mp4');
    expect(pickVideoMime(() => false)).toBe('video/webm');
    expect(extensionFor('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensionFor('video/webm')).toBe('webm');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(cameraRecorder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(cameraRecorder);
  });
});
