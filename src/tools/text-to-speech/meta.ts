import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-to-speech',
  name: 'Text to speech',
  description: 'Read text aloud with the voices built into this device, without sending it anywhere.',
  category: 'text',
  group: 'write',
  keywords: ['speech', 'tts', 'read aloud', 'voice', 'speak'],
  added: '2026-10-18',
  requires: ['speech-synthesis'],
};

export default meta;
