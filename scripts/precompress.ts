// Writes .gz and .br copies of compressible files in dist/ so servers can
// serve them directly (nginx gzip_static, Caddy precompressed, Apache).
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { ROOT } from './lib/tools.ts';
import { walk } from './lib/fs.ts';

const DIST = join(ROOT, 'dist');
const EXTENSIONS = /\.(html|js|mjs|css|svg|json|wasm|webmanifest|xml|txt)$/;
const MIN_BYTES = 1024;

if (import.meta.main) {
  let count = 0;
  let before = 0;
  let after = 0;
  for (const file of walk(DIST)) {
    if (!EXTENSIONS.test(file) || statSync(file).size < MIN_BYTES) continue;
    const data = readFileSync(file);
    const gz = gzipSync(data, { level: 9 });
    const br = brotliCompressSync(data, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length },
    });
    writeFileSync(`${file}.gz`, gz);
    writeFileSync(`${file}.br`, br);
    count++;
    before += data.length;
    after += gz.length;
  }
  console.log(`precompress: ${count} file(s), ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB gzip.`);
}
