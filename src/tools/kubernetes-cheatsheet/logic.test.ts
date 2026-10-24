import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, kubernetesCheatsheet } from './logic.ts';
import meta from './meta.ts';

const commands = (query: string, section?: string) => kubernetesCheatsheet(rows, query, section).map((r) => r.command);

describe('kubernetes cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(220);
  });

  it('has non-empty, trimmed fields in every row', () => {
    for (const row of rows) {
      for (const value of [row.section, row.command, row.description]) {
        expect(value.trim(), JSON.stringify(row)).toBe(value);
        expect(value.length, JSON.stringify(row)).toBeGreaterThan(0);
      }
      expect(row.description, row.command).toMatch(/[.)]$/);
    }
  });

  it('has no duplicate command within a section', () => {
    const keys = rows.map((r) => `${r.section}\u0000${r.command}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only listed sections, and every section has rows', () => {
    const used = new Set(rows.map((r) => r.section));
    for (const s of used) expect(SECTIONS).toContain(s);
    for (const s of SECTIONS) expect(used.has(s), s).toBe(true);
  });

  it('only lists kubectl commands', () => {
    for (const row of rows) expect(row.command).toMatch(/\bkubectl /);
  });
});

describe('kubernetesCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(kubernetesCheatsheet(rows, '')).toHaveLength(rows.length);
  });

  it('finds known commands', () => {
    expect(commands('rollout undo')[0]).toBe('kubectl rollout undo deployment/<name>');
    expect(commands('drain')).toEqual(['kubectl drain <node> --ignore-daemonsets --delete-emptydir-data']);
    expect(commands('custom-columns')).toHaveLength(1);
    expect(commands('ephemeral')).toEqual(['kubectl debug -it <pod> --image=busybox --target=<container>']);
  });

  it('matches every term in any column, ignoring case', () => {
    expect(commands('LOGS Crashed')).toEqual(['kubectl logs <pod> --previous']);
    expect(commands('decode secret')).toContain("kubectl get secret <name> -o jsonpath='{.data.<key>}' | base64 -d");
    expect(commands('pods zzz-nothing')).toEqual([]);
  });

  it('filters by section', () => {
    const nodes = kubernetesCheatsheet(rows, '', 'Nodes');
    expect(nodes.length).toBeGreaterThan(5);
    expect(nodes.every((r) => r.section === 'Nodes')).toBe(true);
    expect(commands('cordon', 'Nodes')).toEqual(['kubectl cordon <node>', 'kubectl uncordon <node>']);
    expect(kubernetesCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(kubernetesCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = kubernetesCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => kubernetesCheatsheet(rows, q));
    expectRobust((q) => kubernetesCheatsheet(rows, q, 'Rollout'));
  });
});
