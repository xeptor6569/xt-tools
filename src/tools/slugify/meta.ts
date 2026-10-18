import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'slugify',
  name: 'Slugify',
  description: 'Turn any text into a clean, URL-friendly slug.',
  category: 'web',
  keywords: ['slug', 'url', 'permalink', 'kebab case', 'seo'],
  added: '2026-10-14',
  examples: [
    { input: 'Hello, World! Ça va?', expect: 'hello-world-ca-va' },
    { input: 'Straße & Café', expect: 'strasse-and-cafe' },
  ],
};

export default meta;
