// Points git at .githooks/ when run inside a git checkout. No-op elsewhere
// (Docker builds, tarballs, CI images without git).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

if (existsSync(join(root, '.git'))) {
  try {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'ignore' });
  } catch {
    // git not installed: nothing to do.
  }
}
