import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'csr-tool',
  name: 'CSR tool',
  description: 'Decode a certificate signing request, or build one with WebCrypto.',
  category: 'crypto',
  keywords: ['csr', 'pkcs10', 'certificate', 'pem', 'request'],
  tags: ['certificate', 'key'],
  examples: [
    {
      input: `-----BEGIN CERTIFICATE REQUEST-----
MIHoMIGQAgEAMC4xGTAXBgNVBAMMEHh0LXRvb2xzLmV4YW1wbGUxETAPBgNVBAoM
CHh0LXRvb2xzMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE5c89Kl6bYFnPMYf1
6zJKd4jydRj7400ALyG2rLrzPO85wTF5vx9uCJn4ss6VlVje04VPjW0SKSOXXDl2
81aVQKAAMAoGCCqGSM49BAMCA0cAMEQCIECCOs0L9dCc3mQKxZiEuDUXNr/56kZQ
dpMc66xwvIxUAiAj5FlpRued6AV/n78wH8HKZXG6BiM4bu8wVjDKZGp7AA==
-----END CERTIFICATE REQUEST-----`,
      expect: 'CN=xt-tools.example',
    },
  ],
  added: '2026-10-24',
  sensitive: true,
  requires: ['webcrypto'],
};

export default meta;
