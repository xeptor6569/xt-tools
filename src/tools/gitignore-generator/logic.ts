// Combines github/gitignore templates (public/data/gitignore-*.json, built by
// scripts/datasets/gitignore.ts) into one .gitignore file.
import { ToolInputError } from '../types.ts';

const MAX_EXTRA = 1_000_000;

export interface GitignoreTemplate {
  /** File name without `.gitignore`, e.g. "Node". */
  name: string;
  group: string;
  /** Path in the upstream repository; unique, used as the id. */
  path: string;
  content: string;
}

export interface GitignoreData {
  commit: string;
  templates: GitignoreTemplate[];
}

export const GROUPS = ['Languages & frameworks', 'Editors, tools & OS', 'Community'] as const;

/** Quick picks, by upstream path. */
export const POPULAR = [
  'Node.gitignore',
  'Python.gitignore',
  'Java.gitignore',
  'Go.gitignore',
  'Rust.gitignore',
  'Global/macOS.gitignore',
  'Global/Windows.gitignore',
  'Global/Linux.gitignore',
  'Global/VisualStudioCode.gitignore',
  'Global/JetBrains.gitignore',
] as const;

/** Display name; community templates in sub-folders show the folder, e.g. "ColdBox (CFML)". */
export function templateLabel(t: Pick<GitignoreTemplate, 'name' | 'path'>): string {
  const parts = t.path.split('/');
  return parts[0] === 'community' && parts.length > 2 ? `${t.name} (${parts.slice(1, -1).join('/')})` : t.name;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}+#]/gu, '');

/** Templates whose name or path contains the query, ignoring case, spaces and punctuation. */
export function searchTemplates(templates: readonly GitignoreTemplate[], query: string): GitignoreTemplate[] {
  const q = norm(query);
  if (q === '') return [...templates];
  return templates.filter((t) => norm(templateLabel(t)).includes(q) || norm(t.path).includes(q));
}

export interface GenerateOptions {
  /** Drop rules already present in an earlier section (comments and blank lines are kept). */
  dedupe?: boolean;
  /** Extra rules appended as a "Custom rules" section. */
  extra?: string;
}

/**
 * Builds the .gitignore text: one `### Name ###` section per template, in the
 * given order, then the extra rules.
 */
export function generateGitignore(selected: readonly GitignoreTemplate[], options: GenerateOptions = {}): string {
  const { dedupe = true, extra = '' } = options;
  if (extra.length > MAX_EXTRA) throw new ToolInputError('Extra rules are too long (maximum 1 MB).');

  const sections = selected.map((t) => ({ title: templateLabel(t), body: t.content }));
  if (extra.trim() !== '') sections.push({ title: 'Custom rules', body: extra });

  // Rule -> position of its last kept copy. A later duplicate is only dropped
  // when no negation (!rule) came in between, since that would change meaning.
  const seen = new Map<string, number>();
  let position = 0;
  let lastNegation = -1;
  const out: string[] = [];

  for (const { title, body } of sections) {
    const lines: string[] = [];
    for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const isRule = line !== '' && !line.startsWith('#');
      if (isRule) {
        position++;
        const previous = seen.get(line);
        if (dedupe && previous !== undefined && previous > lastNegation) continue;
        seen.set(line, position);
        if (line.startsWith('!')) lastNegation = position;
      }
      // Collapse runs of blank lines left behind by removed rules.
      if (line === '' && (lines.length === 0 || lines[lines.length - 1] === '')) continue;
      lines.push(line);
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    out.push(`### ${title} ###`, ...lines, '');
  }
  return out.length > 0 ? `${out.join('\n').replace(/\n+$/, '')}\n` : '';
}
