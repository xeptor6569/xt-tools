import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_VIDEO_BYTES = 128 * 1024 * 1024;

export type VideoOutputMode = 'gif' | 'frames';

export interface VideoJobSpec {
  mode: VideoOutputMode;
  fps: number;
  width: number;
  start: number;
  duration: number;
}

export interface VideoOutputItem {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export interface VideoJobResult {
  summary: string;
  command: string;
  outputs: VideoOutputItem[];
}

export function parseVideoJobSpec(input: string): VideoJobSpec {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const trimmed = input.trim();
  if (trimmed === '') {
    return { mode: 'gif', fps: 10, width: 320, start: 0, duration: 3 };
  }

  let mode: VideoOutputMode = 'gif';
  let fps = 10;
  let width = 320;
  let start = 0;
  let duration = 3;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2 && !trimmed.includes(':') && tokens.slice(0, 2).every((t) => /^\d+(\.\d+)?$/.test(t))) {
    fps = Number(tokens[0]);
    width = Number(tokens[1]);
    if (tokens[2] !== undefined && /^\d+(\.\d+)?$/.test(tokens[2])) start = Number(tokens[2]);
    if (tokens[3] !== undefined && /^\d+(\.\d+)?$/.test(tokens[3])) duration = Number(tokens[3]);
    if (tokens[4] !== undefined) {
      const m = tokens[4].toLowerCase();
      if (m !== 'gif' && m !== 'frames') throw new ToolInputError('Mode must be gif or frames.');
      mode = m;
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      const m = /^([a-z]+)\s*:\s*(.+)$/i.exec(line.trim());
      if (!m) {
        throw new ToolInputError('Use "10 320 0 3 gif" or key: value lines (mode, fps, width, start, duration).');
      }
      const key = m[1]!.toLowerCase();
      const val = m[2]!.trim().toLowerCase();
      if (key === 'mode') {
        if (val !== 'gif' && val !== 'frames') throw new ToolInputError('mode must be gif or frames.');
        mode = val;
      } else if (key === 'fps') fps = Number(val);
      else if (key === 'width') width = Number(val);
      else if (key === 'start') start = Number(val);
      else if (key === 'duration') duration = Number(val);
      else throw new ToolInputError(`Unknown field "${key}".`);
    }
  }

  if (!Number.isFinite(fps) || fps < 1 || fps > 30) {
    throw new ToolInputError('fps must be between 1 and 30.');
  }
  if (!Number.isInteger(width) || width < 32 || width > 1280) {
    throw new ToolInputError('width must be a whole number from 32 to 1280 px.');
  }
  if (!Number.isFinite(start) || start < 0 || start > 36000) {
    throw new ToolInputError('start must be between 0 and 36000 seconds.');
  }
  if (!Number.isFinite(duration) || duration < 0.1 || duration > 30) {
    throw new ToolInputError('duration must be between 0.1 and 30 seconds.');
  }

  return { mode, fps, width, start, duration };
}

export function buildFfmpegArgs(spec: VideoJobSpec, inputName = 'input.mp4'): string[] {
  const vfBase = `fps=${spec.fps},scale=${spec.width}:-1:flags=lanczos`;
  if (spec.mode === 'gif') {
    return [
      '-ss',
      String(spec.start),
      '-t',
      String(spec.duration),
      '-i',
      inputName,
      '-vf',
      `${vfBase},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
      '-loop',
      '0',
      'output.gif',
    ];
  }
  const maxFrames = Math.max(1, Math.min(120, Math.round(spec.fps * spec.duration)));
  return [
    '-ss',
    String(spec.start),
    '-t',
    String(spec.duration),
    '-i',
    inputName,
    '-vf',
    vfBase,
    '-frames:v',
    String(maxFrames),
    'frame-%03d.png',
  ];
}

export function videoToGif(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const spec = parseVideoJobSpec(input);
  const frames = Math.max(1, Math.round(spec.fps * spec.duration));
  const args = buildFfmpegArgs(spec, 'input.mp4');
  return [
    `mode: ${spec.mode} (${frames} frame${frames === 1 ? '' : 's'} at ${spec.fps} fps, width ${spec.width} px, ${spec.start}s–${spec.start + spec.duration}s)`,
    `command: ffmpeg ${args.join(' ')}`,
  ].join('\n');
}

interface FFmpegCoreInstance {
  exec: (...args: string[]) => number;
  ret: number;
  reset: () => void;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string, opts?: { encoding?: string }) => Uint8Array;
    readdir: (path: string) => string[];
    unlink: (path: string) => void;
  };
}

export type FFmpegCoreFactory = (opts: Record<string, unknown>) => Promise<FFmpegCoreInstance>;

export interface FFmpegCoreConfig {
  coreUrl?: string;
  wasmUrl?: string;
  wasmBinary?: Uint8Array;
  createCore?: FFmpegCoreFactory;
}

let ffmpegPromise: Promise<FFmpegCoreInstance> | undefined;

export async function getFfmpegCore(config?: FFmpegCoreConfig): Promise<FFmpegCoreInstance> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const g = globalThis as { self?: unknown; location?: { href: string } };
      g.self ??= globalThis;
      g.location ??= { href: 'file:///ffmpeg-core.js' };

      let createCore: FFmpegCoreFactory | undefined = config?.createCore;
      if (!createCore && config?.coreUrl) {
        const mod = (await import(/* @vite-ignore */ config.coreUrl)) as { default: FFmpegCoreFactory };
        createCore = mod.default;
      }
      if (!createCore) {
        throw new ToolInputError('FFmpeg core URL was not provided.');
      }

      const mainUrl = config?.coreUrl ?? 'file:///ffmpeg-core.js';
      const wasmUrl = config?.wasmUrl ?? 'ffmpeg-core.wasm';
      const hash = btoa(JSON.stringify({ wasmURL: wasmUrl, workerURL: '' }));
      return await createCore({
        ...(config?.wasmBinary ? { wasmBinary: config.wasmBinary } : {}),
        mainScriptUrlOrBlob: `${mainUrl}#${hash}`,
      });
    })();
  }
  return await ffmpegPromise;
}

/**
 * Transcodes a video buffer (or generates a synthetic test clip when `videoBytes` is omitted)
 * into an animated GIF or extracted PNG frames using single-threaded @ffmpeg/core.
 */
export async function runFfmpegJob(
  videoBytes: Uint8Array | undefined,
  specInput: string | VideoJobSpec,
  coreConfig?: FFmpegCoreConfig,
): Promise<VideoJobResult> {
  if (videoBytes && videoBytes.length > MAX_VIDEO_BYTES) {
    throw new ToolInputError('Video file exceeds the 128 MB limit.');
  }
  const spec = typeof specInput === 'string' ? parseVideoJobSpec(specInput) : specInput;
  const ffmpeg = await getFfmpegCore(coreConfig);

  const cleanup: string[] = [];
  try {
    let args: string[];
    if (videoBytes) {
      ffmpeg.FS.writeFile('input.video', videoBytes);
      cleanup.push('input.video');
      args = buildFfmpegArgs(spec, 'input.video');
    } else {
      const dur = Math.min(2, spec.duration);
      const w = Math.min(240, spec.width);
      const h = Math.max(24, Math.round((w * 3) / 4));
      if (spec.mode === 'gif') {
        args = [
          '-f',
          'lavfi',
          '-i',
          `testsrc=duration=${dur}:size=${w}x${h}:rate=${spec.fps}`,
          '-vf',
          `fps=${spec.fps},scale=${w}:-1:flags=lanczos`,
          '-loop',
          '0',
          'output.gif',
        ];
      } else {
        const maxFrames = Math.max(1, Math.min(10, Math.round(spec.fps * dur)));
        args = [
          '-f',
          'lavfi',
          '-i',
          `testsrc=duration=${dur}:size=${w}x${h}:rate=${spec.fps}`,
          '-frames:v',
          String(maxFrames),
          'frame-%03d.png',
        ];
      }
    }

    ffmpeg.exec(...args);
    const ret = ffmpeg.ret;
    ffmpeg.reset();
    if (ret !== 0) {
      throw new ToolInputError(`FFmpeg exited with status ${ret}. Check that the file is a supported video container.`);
    }

    const outputs: VideoOutputItem[] = [];
    if (spec.mode === 'gif') {
      const bytes = new Uint8Array(ffmpeg.FS.readFile('output.gif'));
      cleanup.push('output.gif');
      outputs.push({ filename: 'output.gif', mime: 'image/gif', bytes });
    } else {
      const names = ffmpeg.FS.readdir('/')
        .filter((n) => /^frame-\d+\.png$/.test(n))
        .sort();
      for (const name of names) {
        const bytes = new Uint8Array(ffmpeg.FS.readFile(name));
        cleanup.push(name);
        outputs.push({ filename: name, mime: 'image/png', bytes });
      }
    }

    if (outputs.length === 0) {
      throw new ToolInputError('FFmpeg produced no output frames for that time range.');
    }

    const totalOutBytes = outputs.reduce((s, o) => s + o.bytes.length, 0);
    return {
      summary: `Created ${outputs.length} file(s) (${totalOutBytes.toLocaleString('en')} bytes total) at ${spec.fps} fps, width ${spec.width} px.`,
      command: `ffmpeg ${args.join(' ')}`,
      outputs,
    };
  } finally {
    for (const file of cleanup) {
      try {
        ffmpeg.FS.unlink(file);
      } catch {
        // Ignore already-removed files.
      }
    }
  }
}
