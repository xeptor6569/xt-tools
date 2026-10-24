// Languages offered in the picker. Kept free of Prism imports so the page can
// render the picker before the highlighter chunk has loaded.

export interface Language {
  id: string;
  label: string;
  /** Prism grammar name; empty for plain text. */
  grammar: string;
}

export const LANGUAGES = [
  { id: 'plain', label: 'Plain text', grammar: '' },
  { id: 'bash', label: 'Bash / shell', grammar: 'bash' },
  { id: 'c', label: 'C', grammar: 'c' },
  { id: 'cpp', label: 'C++', grammar: 'cpp' },
  { id: 'csharp', label: 'C#', grammar: 'csharp' },
  { id: 'css', label: 'CSS', grammar: 'css' },
  { id: 'diff', label: 'Diff', grammar: 'diff' },
  { id: 'docker', label: 'Dockerfile', grammar: 'docker' },
  { id: 'go', label: 'Go', grammar: 'go' },
  { id: 'html', label: 'HTML / XML', grammar: 'markup' },
  { id: 'ini', label: 'INI', grammar: 'ini' },
  { id: 'java', label: 'Java', grammar: 'java' },
  { id: 'javascript', label: 'JavaScript', grammar: 'javascript' },
  { id: 'json', label: 'JSON', grammar: 'json' },
  { id: 'jsx', label: 'JSX', grammar: 'jsx' },
  { id: 'kotlin', label: 'Kotlin', grammar: 'kotlin' },
  { id: 'markdown', label: 'Markdown', grammar: 'markdown' },
  { id: 'php', label: 'PHP', grammar: 'php' },
  { id: 'powershell', label: 'PowerShell', grammar: 'powershell' },
  { id: 'python', label: 'Python', grammar: 'python' },
  { id: 'ruby', label: 'Ruby', grammar: 'ruby' },
  { id: 'rust', label: 'Rust', grammar: 'rust' },
  { id: 'scss', label: 'SCSS', grammar: 'scss' },
  { id: 'sql', label: 'SQL', grammar: 'sql' },
  { id: 'swift', label: 'Swift', grammar: 'swift' },
  { id: 'toml', label: 'TOML', grammar: 'toml' },
  { id: 'tsx', label: 'TSX', grammar: 'tsx' },
  { id: 'typescript', label: 'TypeScript', grammar: 'typescript' },
  { id: 'yaml', label: 'YAML', grammar: 'yaml' },
] as const satisfies readonly Language[];

export type LanguageId = (typeof LANGUAGES)[number]['id'];

export function findLanguage(id: string): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
