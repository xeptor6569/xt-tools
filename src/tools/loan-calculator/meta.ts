import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'loan-calculator',
  name: 'Loan calculator',
  description: 'Calculate a loan payment and compound interest.',
  category: 'math',
  keywords: ['loan', 'interest', 'amortization', 'compound', 'payment'],
  tags: ['math', 'finance'],
  added: '2026-10-24',
  examples: [{ input: 'principal 1000 rate 5 years 2', expect: '43.87' }],
};

export default meta;
