import { Document, Scalar, isScalar, isSeq, visit } from 'yaml';
import { ToolInputError } from '../types.ts';
import { composeToRun } from './compose-to-run.ts';
import { runToCompose, type Note } from './run-to-compose.ts';
import { LITERAL_DOLLAR } from './shell.ts';

export type { Note } from './run-to-compose.ts';
export type Direction = 'run-to-compose' | 'compose-to-run';

export interface ConversionResult {
  text: string;
  notes: Note[];
}

const MAX_INPUT = 1_000_000;

/** Converts between docker run commands and a Compose file. Empty input gives empty output. */
export function dockerComposeConverter(input: string, direction: Direction = 'run-to-compose'): ConversionResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return { text: '', notes: [] };
  if (direction === 'compose-to-run') {
    const { script, notes } = composeToRun(input);
    return { text: script, notes };
  }
  const { compose, notes } = runToCompose(input);
  return { text: toYaml(compose), notes };
}

/** Keys whose list items are always double-quoted, as the Compose docs recommend. */
const QUOTED_LISTS = new Set(['ports', 'expose']);

function toYaml(compose: unknown): string {
  // YAML 1.1 rules make the library quote values such as "no", "on" and "22:22"
  // that older parsers would read as booleans or numbers.
  const doc = new Document(compose, { version: '1.1' });
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value === 'string' && node.value.includes(LITERAL_DOLLAR)) {
        node.value = node.value.replaceAll(LITERAL_DOLLAR, '$$$$');
      }
    },
    Pair(_key, pair) {
      if (isScalar(pair.key) && QUOTED_LISTS.has(String(pair.key.value)) && isSeq(pair.value)) {
        for (const item of pair.value.items) {
          if (isScalar(item)) {
            item.value = String(item.value);
            item.type = Scalar.QUOTE_DOUBLE;
          }
        }
      }
    },
  });
  return doc.toString({ lineWidth: 0 });
}
