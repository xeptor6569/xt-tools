import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { parseVideoJobSpec, runFfmpegJob, videoToGif } from './logic.ts';

describe('videoToGif', () => {
  it('parses conversion specs and formats the FFmpeg palette command', () => {
    expect(parseVideoJobSpec('10 320 0 3 gif')).toEqual({
      mode: 'gif',
      fps: 10,
      width: 320,
      start: 0,
      duration: 3,
    });
    const out = videoToGif('10 320 0 3 gif');
    expect(out).toContain('mode: gif (30 frames at 10 fps, width 320 px, 0s–3s)');
    expect(out).toContain('palettegen=max_colors=128');
  });

  it('generates an animated GIF and PNG frames with single-threaded @ffmpeg/core WASM', async () => {
    const g = globalThis as { self?: unknown; location?: { href: string } };
    g.self ??= globalThis;
    g.location ??= { href: 'file:///ffmpeg-core.js' };
    const { default: createCore } = await import('@ffmpeg/core');
    const wasmBinary = readFileSync('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm');
    const gifRes = await runFfmpegJob(
      undefined,
      { mode: 'gif', fps: 5, width: 64, start: 0, duration: 0.4 },
      { wasmBinary, createCore },
    );
    expect(gifRes.outputs).toHaveLength(1);
    const gif = gifRes.outputs[0]!;
    expect(gif.filename).toBe('output.gif');
    expect(new TextDecoder('ascii').decode(gif.bytes.subarray(0, 6))).toBe('GIF89a');

    const frameRes = await runFfmpegJob(
      undefined,
      { mode: 'frames', fps: 5, width: 64, start: 0, duration: 0.4 },
      { wasmBinary, createCore },
    );
    expect(frameRes.outputs.length).toBeGreaterThanOrEqual(1);
    expect(Array.from(frameRes.outputs[0]!.bytes.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => videoToGif(input), { timeLimitMs: 5000 });
  });
});
