import { ToolInputError } from '../types.ts';
import { detect, parse, serialize, type Format } from './formats.ts';

export type From = Format | 'auto';

export interface ConvertResult {
  text: string;
  /** The input format, after auto-detection. */
  from: Format;
}

const MAX_INPUT = 5_000_000;

export function dataFormatConverter(input: string, from: From, to: Format): ConvertResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 5 MB).');
  const source = from === 'auto' ? detect(input) : from;
  if (input.trim() === '') return { text: '', from: source };
  return { text: serialize(parse(input, source), to), from: source };
}
