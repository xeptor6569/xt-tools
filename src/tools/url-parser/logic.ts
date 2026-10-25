import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/** Split an absolute URL into the parts a person usually wants to read. The password is masked. */
export function urlParser(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ToolInputError('Enter an absolute URL, including the scheme (https://…).');
  }
  const keys: string[] = [];
  for (const key of url.searchParams.keys()) if (!keys.includes(key)) keys.push(key);
  return [
    `origin: ${url.origin}`,
    `protocol: ${url.protocol}`,
    `username: ${url.username}`,
    `password: ${url.password ? '••••' : ''}`,
    `host: ${url.hostname}`,
    `port: ${url.port || '(default)'}`,
    `pathname: ${url.pathname}`,
    `query: ${keys.join(', ')}`,
    `hash: ${url.hash}`,
  ].join('\n');
}
