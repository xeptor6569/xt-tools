// Runs after `astro build`. Order matters: the service worker must see the
// final files, the CSP and scans must see the worker, and compression runs
// last so it covers everything.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const steps = ['gen-sw.ts', 'gen-csp.ts', 'scan-dist.ts', 'check-budget.ts', 'precompress.ts'];

for (const step of steps) {
  try {
    execFileSync(process.execPath, [join(import.meta.dirname, step)], { stdio: 'inherit' });
  } catch {
    console.error(`postbuild: ${step} failed.`);
    process.exit(1);
  }
}
