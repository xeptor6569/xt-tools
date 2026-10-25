import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'data-uri',
  name: 'Data URI',
  description: 'Encode text or a file as a data URI, and decode one back.',
  category: 'web',
  keywords: ['data uri', 'base64', 'data url', 'encode'],
  examples: [{ input: 'hello', expect: 'data:text/plain;charset=utf-8,hello' }],
  added: '2026-10-24',
};

export default meta;
