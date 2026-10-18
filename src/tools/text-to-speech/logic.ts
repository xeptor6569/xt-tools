import { ToolInputError } from '../types.ts';

export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  voiceURI: string;
}

const MAX_INPUT = 200_000;

/**
 * Splits text into sentence-sized chunks. Browsers stop long utterances
 * part-way through, so each chunk is spoken separately.
 */
export function chunkText(text: string, max = 200): string[] {
  if (text.length > MAX_INPUT) throw new ToolInputError('Text is too long (maximum 200,000 characters).');
  const sentences =
    text
      .replace(/\s+/g, ' ')
      .trim()
      .match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    let s = sentence.trim();
    while (s.length > max) {
      const cut = s.lastIndexOf(' ', max);
      const at = cut > max / 2 ? cut : max;
      chunks.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) chunks.push(s);
  }
  return chunks;
}

/**
 * Only voices that run on this device. Remote voices (e.g. Chrome's "Google"
 * voices) send the text to a server, so they are never offered.
 */
export function localVoices(voices: readonly VoiceInfo[]): VoiceInfo[] {
  return voices
    .filter((v) => v.localService)
    .sort(
      (a, b) => Number(b.default) - Number(a.default) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name),
    );
}
