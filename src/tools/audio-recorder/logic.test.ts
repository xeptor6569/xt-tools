import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { audioRecorder, extensionFor, pickAudioMime, waveformBars } from './logic.ts';
import meta from './meta.ts';

describe('audioRecorder', () => {
  it('builds a safe file name', () => {
    expect(audioRecorder('')).toBe('audio.webm');
    expect(audioRecorder('voice')).toBe('voice.webm');
    expect(audioRecorder('My Clip!')).toBe('My-Clip.webm');
  });

  it('turns analyser samples into bar heights', () => {
    const samples = new Uint8Array(8).fill(128);
    samples[2] = 0;
    expect(waveformBars(samples, 4)).toEqual([0, 100, 0, 0]);
    expect(waveformBars([], 3)).toEqual([0, 0, 0]);
  });

  it('picks the first supported audio type', () => {
    expect(pickAudioMime((mime) => mime === 'audio/ogg')).toBe('audio/ogg');
    expect(pickAudioMime(() => false)).toBe('audio/webm');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(audioRecorder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(audioRecorder);
  });
});
