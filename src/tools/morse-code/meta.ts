import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'morse-code',
  name: 'Morse code',
  description: 'Translate text to Morse code and back, and play it as audio.',
  category: 'converter',
  group: 'signals',
  keywords: ['morse', 'code', 'telegraph', 'audio', 'dots and dashes'],
  examples: [
    { input: 'SOS', expect: '... --- ...' },
    { input: '.... . .-.. .-.. ---', expect: 'HELLO' },
  ],
  added: '2026-10-18',
};

export default meta;
