import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'video-to-gif',
  name: 'Video to GIF',
  description: 'Convert a video clip to an animated GIF or extract frames with ffmpeg.wasm.',
  category: 'images-media',
  keywords: ['video', 'gif', 'ffmpeg', 'frames', 'extract', 'webm', 'mp4', 'animation'],
  tags: ['video', 'gif', 'ffmpeg'],
  added: '2026-11-06',
  heavy: true,
  examples: [
    {
      input: '10 320 0 3 gif',
      expect: 'mode: gif (30 frames at 10 fps, width 320 px, 0s–3s)',
    },
  ],
};

export default meta;
