// Validates a tool's metadata against the contract. Shared by the registry
// (fails the Astro build) and scripts/validate-tools.ts. Keep it dependency-free
// so plain Node can import it.
import { categoryIds, groupIdsFor } from '../categories.ts';
import { capabilityIds } from '../capabilities.ts';
import { isNetworkHost } from '../lib/network-allow.ts';

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isString = (v: unknown): v is string => typeof v === 'string';

export function validateMeta(meta: unknown, expectedId?: string, today = new Date()): string[] {
  const problems: string[] = [];
  if (typeof meta !== 'object' || meta === null) return ['metadata must be an object'];
  const m = meta as Record<string, unknown>;

  const allowed = new Set([
    'id',
    'name',
    'description',
    'category',
    'group',
    'keywords',
    'added',
    'sensitive',
    'requires',
    'heavy',
    'legacy',
    'network',
    'examples',
  ]);
  for (const key of Object.keys(m)) {
    if (!allowed.has(key)) problems.push(`unknown field "${key}"`);
  }

  if (!isString(m.id) || !ID_PATTERN.test(m.id) || m.id.length < 2 || m.id.length > 40) {
    problems.push('id must be kebab-case and 2–40 characters');
  } else if (expectedId !== undefined && m.id !== expectedId) {
    problems.push(`id "${m.id}" does not match folder name "${expectedId}"`);
  }

  if (!isString(m.name) || m.name.trim().length < 2 || m.name.length > 40) {
    problems.push('name must be 2–40 characters');
  } else if (m.name !== m.name.trim()) {
    problems.push('name must not have leading or trailing spaces');
  }

  if (!isString(m.description)) {
    problems.push('description is required');
  } else {
    const d = m.description;
    if (d.length < 20 || d.length > 160) problems.push('description must be 20–160 characters');
    if (!/[.!?]$/.test(d)) problems.push('description must be one sentence ending with a period');
    else if (/[.!?]\s+[A-Z]/.test(d.slice(0, -1))) problems.push('description must be a single sentence');
  }

  if (!isString(m.category) || !categoryIds.includes(m.category)) {
    problems.push(`category must be one of: ${categoryIds.join(', ')}`);
  } else {
    const groups = groupIdsFor(m.category);
    if (groups) {
      if (!isString(m.group) || !groups.includes(m.group)) {
        problems.push(`group must be one of: ${groups.join(', ')}`);
      }
    } else if (m.group !== undefined) {
      problems.push('this category has no groups');
    }
  }

  if (!Array.isArray(m.keywords) || m.keywords.length === 0) {
    problems.push('keywords must be a non-empty array');
  } else {
    const seen = new Set<string>();
    for (const k of m.keywords) {
      if (!isString(k) || k.trim() === '') problems.push('keywords must be non-empty strings');
      else if (k !== k.toLowerCase()) problems.push(`keyword "${k}" must be lowercase`);
      else if (seen.has(k)) problems.push(`keyword "${k}" is duplicated`);
      else seen.add(k);
    }
  }

  if (!isString(m.added) || !/^\d{4}-\d{2}-\d{2}$/.test(m.added) || Number.isNaN(Date.parse(m.added))) {
    problems.push('added must be an ISO date (YYYY-MM-DD)');
  } else if (Date.parse(m.added) > today.getTime() + 36 * 3600 * 1000) {
    problems.push('added must not be in the future');
  }

  for (const flag of ['sensitive', 'heavy'] as const) {
    if (m[flag] !== undefined && typeof m[flag] !== 'boolean') problems.push(`${flag} must be a boolean`);
  }

  if (m.legacy !== undefined && (!isString(m.legacy) || m.legacy.trim().length < 10)) {
    problems.push('legacy must be warning text of at least 10 characters');
  }

  if (m.network !== undefined) {
    const network = m.network as { hosts?: unknown } | null;
    const hosts = network && typeof network === 'object' && !Array.isArray(network) ? network.hosts : undefined;
    const extra =
      network && typeof network === 'object' && !Array.isArray(network)
        ? Object.keys(network).filter((key) => key !== 'hosts')
        : [];
    if (!network || typeof network !== 'object' || Array.isArray(network) || extra.length > 0) {
      problems.push('network must be an object with a hosts array');
    } else if (!Array.isArray(hosts) || hosts.length === 0) {
      problems.push('network.hosts must list at least one allowlisted origin');
    } else {
      const seen = new Set<string>();
      for (const host of hosts) {
        if (!isString(host) || !isNetworkHost(host)) {
          problems.push(`network.hosts: "${String(host)}" is not an allowlisted origin`);
        } else if (seen.has(host)) problems.push(`network.hosts: "${host}" is duplicated`);
        else seen.add(host);
      }
    }
  }

  if (m.requires !== undefined) {
    if (!Array.isArray(m.requires)) problems.push('requires must be an array');
    else {
      for (const r of m.requires) {
        if (!isString(r) || !capabilityIds.includes(r)) {
          problems.push(`requires: unknown capability "${String(r)}" (valid: ${capabilityIds.join(', ')})`);
        }
      }
    }
  }

  if (m.examples !== undefined) {
    if (!Array.isArray(m.examples)) problems.push('examples must be an array');
    else {
      for (const [i, ex] of m.examples.entries()) {
        const e = ex as Record<string, unknown> | null;
        if (!e || !isString(e.input) || !isString(e.expect) || e.expect === '') {
          problems.push(`examples[${i}] must have string "input" and non-empty "expect"`);
        }
      }
    }
  }

  return problems;
}
