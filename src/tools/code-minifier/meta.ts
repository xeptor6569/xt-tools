import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'code-minifier',
  name: 'Code minifier',
  description: 'Minify and beautify HTML, CSS and JavaScript without running it.',
  category: 'web',
  keywords: ['minify', 'beautify', 'html', 'css', 'javascript'],
  examples: [{ input: 'html\n<p>Hello</p> <!-- note -->', expect: '<p>Hello</p>' }],
  added: '2026-10-24',
  heavy: true,
};

export default meta;
