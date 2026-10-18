import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { chunkText, localVoices, type VoiceInfo } from './logic.ts';

const voice = (name: string, localService: boolean, lang = 'en-US', isDefault = false): VoiceInfo => ({
  name,
  lang,
  localService,
  default: isDefault,
  voiceURI: name,
});

describe('text to speech', () => {
  it('splits text into sentences', () => {
    expect(chunkText('Hello there. How are you?  Fine!')).toEqual(['Hello there.', 'How are you?', 'Fine!']);
  });

  it('splits long sentences at spaces', () => {
    const chunks = chunkText(`${'word '.repeat(100)}end.`, 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(' ')).toBe(`${'word '.repeat(100)}end.`);
  });

  it('never offers voices that send text to a server', () => {
    const voices = [
      voice('Google US English', false),
      voice('Samantha', true),
      voice('Alex', true, 'en-US', true),
      voice('Thomas', true, 'fr-FR'),
    ];
    expect(localVoices(voices).map((v) => v.name)).toEqual(['Alex', 'Samantha', 'Thomas']);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => chunkText(s));
  });
});
