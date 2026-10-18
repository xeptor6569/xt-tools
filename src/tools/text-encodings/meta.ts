import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'text-encodings',
  name: 'Text encodings',
  description: 'Encode text as quoted-printable, UTF-7, UTF-16 or percent-encoding and decode it again.',
  category: 'converter',
  keywords: ['quoted-printable', 'utf-7', 'utf-16', 'encoding', 'mime', 'email'],
  examples: [{ input: 'Grüße, café!', expect: 'Gr=C3=BC=C3=9Fe, caf=C3=A9!' }],
  added: '2026-10-18',
};

export default meta;
