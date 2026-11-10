// Runs Video to GIF off the main thread using the local single-threaded @ffmpeg/core assets.
import coreJsUrl from '@ffmpeg/core?url';
import coreWasmUrl from '@ffmpeg/core/wasm?url';
import { resolveLocalAsset } from '../../lib/load-local-asset.ts';
import { expose } from '../../lib/worker-rpc.ts';
import { runFfmpegJob, videoToGif, type VideoJobSpec } from './logic.ts';

expose({
  videoToGif,
  runFfmpegJob: (videoBytes: Uint8Array | undefined, spec: string | VideoJobSpec) =>
    runFfmpegJob(videoBytes, spec, {
      coreUrl: resolveLocalAsset(coreJsUrl).href,
      wasmUrl: resolveLocalAsset(coreWasmUrl).href,
    }),
});
