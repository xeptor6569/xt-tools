import { ToolInputError } from '../types.ts';

const MAX_INPUT = 256;

interface Strength {
  score: number;
  guesses: number;
  crack: string;
  warning: string;
  suggestions: string[];
}

let factoryPromise: Promise<{ check: (password: string) => Strength }> | null = null;

function loadFactory(): Promise<{ check: (password: string) => Strength }> {
  factoryPromise ??= (async () => {
    const [{ ZxcvbnFactory }, common, en] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]);
    const factory = new ZxcvbnFactory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
    });
    return {
      check(password: string): Strength {
        const result = factory.check(password);
        return {
          score: result.score,
          guesses: result.guesses,
          crack: result.crackTimes.offlineSlowHashingXPerSecond.display,
          warning: result.feedback.warning ?? '',
          suggestions: result.feedback.suggestions,
        };
      },
    };
  })();
  return factoryPromise;
}

function format(result: Strength): string {
  const lines = [`score: ${result.score}/4`, `guesses: ${result.guesses}`, `offline slow-hash time: ${result.crack}`];
  if (result.warning) lines.push(`warning: ${result.warning}`);
  if (result.suggestions.length) lines.push(`suggestions: ${result.suggestions.join(' ')}`);
  return lines.join('\n');
}

/** Estimates guessability with zxcvbn. Dictionaries load on first use. */
export async function passwordStrength(input: string): Promise<string> {
  if (input.length > MAX_INPUT)
    throw new ToolInputError(`Password is too long to score (maximum ${MAX_INPUT} characters).`);
  if (input.length === 0) return 'score: 0/4\nguesses: 1\nwarning: The password is empty.';
  const factory = await loadFactory();
  return format(factory.check(input));
}
