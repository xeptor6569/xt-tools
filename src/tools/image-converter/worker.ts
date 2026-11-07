// Runs WASM image codecs (OxiPNG, MozJPEG, libwebp, libavif) off the main thread.
import avifWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import jpegWasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import webpWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
import { loadLocalAsset } from '../../lib/load-local-asset.ts';
import { expose } from '../../lib/worker-rpc.ts';
import { encodeRgbaWithWasm, imageConverter, type ImageFormat, type WasmCodecId } from './logic.ts';

const URLS: Record<WasmCodecId, string> = {
  png: pngWasmUrl,
  oxipng: oxipngWasmUrl,
  jpeg: jpegWasmUrl,
  webp: webpWasmUrl,
  avif: avifWasmUrl,
};

const compiled = new Map<WasmCodecId, Promise<WebAssembly.Module>>();

function loadCodecWasm(codec: WasmCodecId): Promise<WebAssembly.Module> {
  let promise = compiled.get(codec);
  if (!promise) {
    promise = loadLocalAsset(URLS[codec])
      .then((r) => r.arrayBuffer())
      .then((buf) => WebAssembly.compile(buf));
    compiled.set(codec, promise);
  }
  return promise;
}

expose({
  imageConverter,
  encodeRgba: (rgba: Uint8ClampedArray, width: number, height: number, format: ImageFormat, quality: number) =>
    encodeRgbaWithWasm(rgba, width, height, format, quality, loadCodecWasm),
});
