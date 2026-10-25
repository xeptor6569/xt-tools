import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'camera-recorder',
  name: 'Camera recorder',
  description: 'Record the camera and microphone and download the clip.',
  category: 'images-media',
  keywords: ['camera', 'record', 'video', 'microphone'],
  tags: ['video', 'recording'],
  added: '2026-10-24',
  requires: ['camera', 'microphone'],
  examples: [{ input: 'interview', expect: 'interview.webm' }],
};

export default meta;
