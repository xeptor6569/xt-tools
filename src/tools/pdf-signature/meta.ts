import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'pdf-signature',
  name: 'PDF signature checker',
  description: 'Inspect and verify embedded PKCS#7 digital signatures inside a PDF document.',
  category: 'crypto',
  keywords: ['pdf', 'signature', 'pkcs7', 'cms', 'x509', 'verify', 'certificate', 'byterange'],
  tags: ['pdf', 'signature', 'certificate'],
  added: '2026-11-06',
  requires: ['webcrypto'],
  heavy: true,
  examples: [
    {
      input:
        '%PDF-1.7\n1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (Alice Example) /Reason (Release sign-off) /ByteRange [0 120 200 40] /Contents <0000> >>\nendobj',
      expect: 'subFilter: adbe.pkcs7.detached',
    },
  ],
};

export default meta;
