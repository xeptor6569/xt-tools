import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'xml-formatter',
  name: 'XML formatter',
  description:
    'Pretty-print or minify XML and check that it is well-formed, keeping comments, CDATA and entities intact.',
  category: 'development',
  group: 'formatters',
  keywords: ['xml', 'format', 'prettify', 'beautify', 'minify', 'validate', 'indent', 'well-formed', 'pretty print'],
  tags: ['xml', 'format'],
  added: '2026-10-24',
  examples: [
    { input: '<a><b>1</b></a>', expect: '  <b>1</b>' },
    {
      input: '<?xml version="1.0"?><list><item id="1"/><!-- note --><item id="2">two</item></list>',
      expect: '  <!-- note -->',
    },
  ],
};

export default meta;
