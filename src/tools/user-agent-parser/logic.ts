import Bowser from 'bowser';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

function field(value: string | undefined): string {
  return value ? value : '(unknown)';
}

/** Browser, version, OS and engine, from bowser. */
export function userAgentParser(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  let parsed: ReturnType<typeof Bowser.parse>;
  try {
    parsed = Bowser.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not parse that user-agent.';
    throw new ToolInputError(message);
  }
  return [
    `browser: ${field(parsed.browser.name)}`,
    `version: ${field(parsed.browser.version)}`,
    `os: ${field(parsed.os.name)}`,
    `engine: ${field(parsed.engine.name)}`,
  ].join('\n');
}
