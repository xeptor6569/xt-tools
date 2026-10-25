import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'mac-vendor',
  name: 'MAC vendor lookup',
  description: 'Look up a MAC address vendor from the bundled IEEE OUI list.',
  category: 'network',
  keywords: ['mac', 'oui', 'vendor', 'ieee', 'address'],
  tags: ['network', 'mac'],
  examples: [
    { input: '00:00:0C:11:22:33', expect: 'Cisco Systems, Inc' },
    { input: '8C:1F:64:AF:A0:11', expect: 'DATA ELECTRONIC DEVICES, INC' },
  ],
  added: '2026-10-24',
  heavy: true,
};

export default meta;
