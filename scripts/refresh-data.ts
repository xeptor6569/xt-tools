// Developer-only: downloads a hand-curated dataset into public/data/ and
// records its source, version, license and SHA-256 in docs/datasets.md.
// Never runs during the build; the downloaded file is committed.
//
// Usage: node scripts/refresh-data.ts <dataset>
//
// Each dataset is a module in scripts/datasets/<name>.ts that exports
// `refresh(): Promise<Dataset>`. The module downloads and shapes the data and
// may update its tool's file-name constant; this script writes the file,
// removes older versions of the same dataset and updates the docs.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/tools.ts';

export interface Dataset {
  /** Stable prefix shared by every version, e.g. "gitignore". */
  name: string;
  /** Versioned file name under public/data/, e.g. "gitignore-0e5d690.json". */
  file: string;
  content: string;
  /** Human-readable source, e.g. "github/gitignore". */
  source: string;
  /** Upstream URL (documentation only; the site never requests it). */
  url: string;
  version: string;
  license: string;
  /** Which tool uses it. */
  tool: string;
  notes?: string;
}

const DATASETS_DIR = join(ROOT, 'scripts', 'datasets');
const DATA_DIR = join(ROOT, 'public', 'data');
const DOC = join(ROOT, 'docs', 'datasets.md');

const available = existsSync(DATASETS_DIR)
  ? readdirSync(DATASETS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.slice(0, -3))
      .sort()
  : [];

const name = process.argv[2];
if (!name || !available.includes(name)) {
  console.error(`Usage: node scripts/refresh-data.ts <dataset>\nDatasets: ${available.join(', ') || '(none)'}`);
  process.exit(1);
}

const mod = (await import(pathToFileURL(join(DATASETS_DIR, `${name}.ts`)).href)) as {
  refresh: () => Promise<Dataset>;
};
const data = await mod.refresh();
if (!data.file.startsWith(`${data.name}-`)) throw new Error(`${data.file} must start with "${data.name}-"`);

mkdirSync(DATA_DIR, { recursive: true });
for (const old of readdirSync(DATA_DIR)) {
  if (old.startsWith(`${data.name}-`) && old !== data.file) {
    rmSync(join(DATA_DIR, old));
    console.log(`  - removed public/data/${old}`);
  }
}
writeFileSync(join(DATA_DIR, data.file), data.content);
const sha256 = createHash('sha256').update(data.content).digest('hex');
const kb = (Buffer.byteLength(data.content) / 1024).toFixed(1);
console.log(`  + public/data/${data.file} (${kb} KB, sha256 ${sha256})`);

const begin = `<!-- dataset:${data.name} -->`;
const end = `<!-- /dataset:${data.name} -->`;
const block = [
  begin,
  `### ${data.name}`,
  '',
  `| Field | Value |`,
  `| --- | --- |`,
  `| Tool | \`${data.tool}\` |`,
  `| File | \`public/data/${data.file}\` |`,
  `| Source | ${data.source} (<${data.url}>) |`,
  `| Version | ${data.version} |`,
  `| License | ${data.license} |`,
  `| Retrieved | ${new Date().toISOString().slice(0, 10)} |`,
  `| SHA-256 | \`${sha256}\` |`,
  `| Refresh | \`node scripts/refresh-data.ts ${data.name}\` |`,
  ...(data.notes ? ['', data.notes] : []),
  end,
].join('\n');

let doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
const start = doc.indexOf(begin);
if (start >= 0) {
  const stop = doc.indexOf(end, start);
  doc = doc.slice(0, start) + block + doc.slice(stop + end.length);
} else {
  doc = `${doc.trimEnd()}\n\n${block}\n`;
}
writeFileSync(DOC, doc);
console.log(`  ~ docs/datasets.md (${data.name})`);
console.log('Run `npm run format` to normalise the docs table, then commit the data file and the docs.');
