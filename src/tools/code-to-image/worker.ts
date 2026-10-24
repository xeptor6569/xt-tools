// Tokenizes off the main thread. Some Prism grammars get very slow on
// pathological input; the UI terminates this worker after a timeout and falls
// back to plain text, so the page never freezes.
import { expose } from '../../lib/worker-rpc.ts';
import { tokenize } from './highlight.ts';
import { tokensToLines, validateCode, type Line } from './logic.ts';

function highlight(code: string, languageId: string, tabSize: number): Line[] {
  return tokensToLines(tokenize(validateCode(code), languageId), tabSize);
}

expose({ highlight });
