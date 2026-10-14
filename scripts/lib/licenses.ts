// Reads package-lock.json to list the packages whose code ships to the browser
// and checks their licenses. Used by scripts/check-licenses.ts and the
// /licenses/ page. Node built-ins only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ShippedPackage {
  name: string;
  version: string;
  license: string;
  homepage?: string;
}

interface Policy {
  allow: string[];
  shipped: string[];
  exceptions: Record<string, string>;
}

interface LockEntry {
  version?: string;
  license?: string;
  dev?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  peer?: boolean;
  link?: boolean;
}

export const ROOT = join(import.meta.dirname, '..', '..');

export function readPolicy(root = ROOT): Policy {
  return JSON.parse(readFileSync(join(root, 'scripts', 'licenses.allow.json'), 'utf8')) as Policy;
}

function nameFromPath(path: string): string {
  const i = path.lastIndexOf('node_modules/');
  return path.slice(i + 'node_modules/'.length);
}

function readHomepage(root: string, path: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')) as {
      homepage?: string;
      repository?: string | { url?: string };
    };
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    return pkg.homepage ?? repo?.replace(/^git\+/, '').replace(/\.git$/, '');
  } catch {
    return undefined;
  }
}

/**
 * Production dependencies (not dev-only in the lockfile) plus the packages
 * listed in `shipped`. Build tooling under devDependencies is excluded because
 * it never reaches the browser.
 */
export function shippedPackages(root = ROOT): ShippedPackage[] {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockEntry>;
  };
  const policy = readPolicy(root);
  const result = new Map<string, ShippedPackage>();

  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '' || entry.link) continue;
    const name = nameFromPath(path);
    const isProd = !entry.dev && !entry.devOptional;
    const isShipped = policy.shipped.includes(name) && path === `node_modules/${name}`;
    if (!isProd && !isShipped) continue;
    const key = `${name}@${entry.version ?? '?'}`;
    if (result.has(key)) continue;
    const homepage = readHomepage(root, path);
    result.set(key, {
      name,
      version: entry.version ?? '?',
      license: entry.license ?? 'UNKNOWN',
      ...(homepage ? { homepage } : {}),
    });
  }

  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** True when an SPDX expression is satisfied by the allowlist (OR = any, AND = all). */
export function licenseAllowed(expression: string, allow: readonly string[]): boolean {
  const expr = expression.trim().replace(/^\((.*)\)$/, '$1');
  if (/\s+OR\s+/i.test(expr)) return expr.split(/\s+OR\s+/i).some((part) => licenseAllowed(part, allow));
  if (/\s+AND\s+/i.test(expr)) return expr.split(/\s+AND\s+/i).every((part) => licenseAllowed(part, allow));
  return allow.includes(expr);
}

export function licenseProblems(root = ROOT): string[] {
  const policy = readPolicy(root);
  const problems: string[] = [];
  for (const pkg of shippedPackages(root)) {
    if (policy.exceptions[pkg.name]) continue;
    if (!licenseAllowed(pkg.license, policy.allow)) {
      problems.push(`${pkg.name}@${pkg.version}: license "${pkg.license}" is not on the allowlist`);
    }
  }
  return problems;
}
