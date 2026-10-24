import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { DATA_FILE } from './dataset.ts';
import {
  generateGitignore,
  GROUPS,
  POPULAR,
  searchTemplates,
  templateLabel,
  type GitignoreData,
  type GitignoreTemplate,
} from './logic.ts';

const data = JSON.parse(readFileSync(join(import.meta.dirname, '../../../public', DATA_FILE), 'utf8')) as GitignoreData;
const byPath = (path: string) => {
  const t = data.templates.find((x) => x.path === path);
  if (!t) throw new Error(`missing ${path}`);
  return t;
};
const tpl = (name: string, content: string): GitignoreTemplate => ({ name, group: GROUPS[0], path: name, content });

describe('bundled dataset', () => {
  it('is pinned to a commit and has every group', () => {
    expect(data.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(DATA_FILE).toBe(`data/gitignore-${data.commit.slice(0, 7)}.json`);
    for (const g of GROUPS)
      expect(
        data.templates.some((t) => t.group === g),
        g,
      ).toBe(true);
    expect(data.templates.every((t) => (GROUPS as readonly string[]).includes(t.group))).toBe(true);
    expect(new Set(data.templates.map((t) => t.path)).size).toBe(data.templates.length);
  });

  it('contains every quick pick', () => {
    for (const p of POPULAR) expect(byPath(p).content.length).toBeGreaterThan(0);
  });

  it('has real template content', () => {
    expect(byPath('Node.gitignore').content).toContain('node_modules/');
    expect(byPath('Global/macOS.gitignore').content).toContain('.DS_Store');
    expect(byPath('Python.gitignore').content).toContain('__pycache__/');
  });
});

describe('templateLabel', () => {
  it('disambiguates community sub-folders', () => {
    expect(templateLabel({ name: 'Node', path: 'Node.gitignore' })).toBe('Node');
    expect(templateLabel({ name: 'macOS', path: 'Global/macOS.gitignore' })).toBe('macOS');
    expect(templateLabel({ name: 'Racket', path: 'community/Racket.gitignore' })).toBe('Racket');
    expect(templateLabel({ name: 'ColdBox', path: 'community/CFML/ColdBox.gitignore' })).toBe('ColdBox (CFML)');
  });

  it('gives each template a unique label within its group', () => {
    for (const g of GROUPS) {
      const labels = data.templates.filter((t) => t.group === g).map(templateLabel);
      expect(new Set(labels).size, g).toBe(labels.length);
    }
  });
});

describe('searchTemplates', () => {
  it('matches case-insensitively, ignoring spaces and punctuation', () => {
    expect(searchTemplates(data.templates, 'visual studio code').map((t) => t.path)).toContain(
      'Global/VisualStudioCode.gitignore',
    );
    expect(searchTemplates(data.templates, 'NODE').map((t) => t.path)).toContain('Node.gitignore');
    expect(searchTemplates(data.templates, 'c++').map((t) => t.name)).toContain('C++');
    expect(searchTemplates(data.templates, 'global/').length).toBeGreaterThan(50);
  });

  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchTemplates(data.templates, '  ')).toHaveLength(data.templates.length);
    expect(searchTemplates(data.templates, 'zzzqqq')).toEqual([]);
  });
});

describe('generateGitignore', () => {
  it('returns an empty string when nothing is selected', () => {
    expect(generateGitignore([])).toBe('');
    expect(generateGitignore([], { extra: '  \n' })).toBe('');
  });

  it('adds section headers and the custom rules', () => {
    const out = generateGitignore([tpl('A', '# a\nfoo\n\n\n'), tpl('B', 'bar\r\n')], { extra: '.env\n' });
    expect(out).toBe('### A ###\n# a\nfoo\n\n### B ###\nbar\n\n### Custom rules ###\n.env\n');
  });

  it('removes duplicate rules but keeps comments and the first occurrence', () => {
    const a = tpl('A', '# Logs\n*.log\n.DS_Store\n');
    const b = tpl('B', '# Logs\n*.log\n\n# Build\ndist/\n.DS_Store  \n');
    expect(generateGitignore([a, b])).toBe(
      '### A ###\n# Logs\n*.log\n.DS_Store\n\n### B ###\n# Logs\n\n# Build\ndist/\n',
    );
    expect(generateGitignore([a, b], { dedupe: false })).toContain('### B ###\n# Logs\n*.log\n');
  });

  it('keeps a duplicate when a negation came in between', () => {
    const out = generateGitignore([tpl('A', '*.log'), tpl('B', '!keep.log'), tpl('C', '*.log\n*.tmp\n*.tmp')]);
    expect(out).toBe('### A ###\n*.log\n\n### B ###\n!keep.log\n\n### C ###\n*.log\n*.tmp\n');
  });

  it('combines real templates', () => {
    const out = generateGitignore([byPath('Node.gitignore'), byPath('Global/macOS.gitignore')]);
    expect(out.startsWith('### Node ###\n')).toBe(true);
    expect(out).toContain('\n### macOS ###\n');
    expect(out).toContain('node_modules/');
    expect(out.endsWith('\n')).toBe(true);
    expect(out.split('\n').filter((l) => l === 'node_modules/')).toHaveLength(1);
  });

  it('dedupes across overlapping real templates', () => {
    const all = generateGitignore(data.templates.slice(0, 50), { dedupe: true });
    const rules = all.split('\n').filter((l) => l !== '' && !l.startsWith('#'));
    const raw = generateGitignore(data.templates.slice(0, 50), { dedupe: false });
    expect(rules.length).toBeLessThan(raw.split('\n').filter((l) => l !== '' && !l.startsWith('#')).length);
  });

  it('survives empty, huge and malformed extra rules and queries', () => {
    const node = [byPath('Node.gitignore')];
    expectRobust((extra) => generateGitignore(node, { extra }));
    expectRobust((query) => searchTemplates(data.templates, query));
    expect(() => generateGitignore(node, { extra: 'a'.repeat(1_000_001) })).toThrow('too long');
  });
});
