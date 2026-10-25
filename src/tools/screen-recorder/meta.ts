import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'screen-recorder',
  name: 'Screen recorder',
  description: 'Record the screen and download the clip.',
  category: 'images-media',
  keywords: ['screen', 'record', 'capture', 'video'],
  tags: ['video', 'recording'],
  added: '2026-10-24',
  requires: ['display-capture'],
  examples: [{ input: 'demo', expect: 'demo.webm' }],
};

export default meta;
