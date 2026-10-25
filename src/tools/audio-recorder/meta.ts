import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'audio-recorder',
  name: 'Audio recorder',
  description: 'Record the microphone and show a live waveform.',
  category: 'images-media',
  keywords: ['audio', 'record', 'microphone', 'waveform'],
  added: '2026-10-24',
  requires: ['microphone'],
  examples: [{ input: 'voice', expect: 'voice.webm' }],
};

export default meta;
