import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'fancy-text',
  name: 'Fancy text',
  description: 'Turn text into bold, italic, script, double-struck and other Unicode styles.',
  category: 'text',
  group: 'transform',
  keywords: ['fancy', 'unicode', 'bold', 'italic', 'font', 'cursive', 'styled text'],
  tags: ['text', 'unicode'],
  examples: [{ input: 'Hello', expect: '𝐇𝐞𝐥𝐥𝐨' }],
  added: '2026-10-18',
};

export default meta;
