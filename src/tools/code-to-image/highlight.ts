// Prism tokenizer with the languages offered by the tool. Lazy-loaded by the
// UI as a single chunk. Only `tokenize` is used: Prism's HTML output is never
// produced or inserted anywhere.
//
// Import order matters. The setup module sets `Prism.manual` before the core
// evaluates, and every language component is a script that extends the global
// `Prism`, so each one must come after the grammars it builds on.
import './prism-setup.ts';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-ini';
import { findLanguage } from './languages.ts';
import type { TokenStreamLike } from './logic.ts';

/**
 * Tokenizes `code` for the given language id. Runs the tokenize hooks too, so
 * PHP embedded in HTML is handled like Prism.highlight would.
 */
export function tokenize(code: string, languageId: string): TokenStreamLike {
  const name = findLanguage(languageId).grammar;
  const grammar = name ? Prism.languages[name] : undefined;
  if (!grammar) return [code];
  const env: Record<string, unknown> & { code: string; grammar: Prism.Grammar; language: string } = {
    code,
    grammar,
    language: name,
  };
  Prism.hooks.run('before-tokenize', env);
  const tokens = Prism.tokenize(env.code, env.grammar);
  env['tokens'] = tokens;
  Prism.hooks.run('after-tokenize', env);
  return env['tokens'] as TokenStreamLike;
}

/** For tests: whether every offered language has a grammar. */
export function hasGrammar(name: string): boolean {
  return name in Prism.languages;
}
