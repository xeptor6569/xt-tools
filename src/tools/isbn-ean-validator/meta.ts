import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'isbn-ean-validator',
  name: 'ISBN and EAN',
  description: 'Validate ISBN, EAN-13 and UPC-A check digits.',
  category: 'data',
  keywords: ['isbn', 'ean', 'upc', 'barcode', 'checksum'],
  tags: ['checksum', 'barcode'],
  added: '2026-10-24',
  examples: [{ input: '9780306406157', expect: 'valid' }],
};

export default meta;
