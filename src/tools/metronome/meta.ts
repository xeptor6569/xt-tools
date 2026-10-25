import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'metronome',
  name: 'Metronome',
  description: 'Click a steady tempo and play a tone with WebAudio.',
  category: 'measurement',
  keywords: ['metronome', 'tempo', 'bpm', 'tone'],
  added: '2026-10-24',
  examples: [{ input: '100', expect: '100 BPM' }],
};

export default meta;
