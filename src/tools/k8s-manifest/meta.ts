import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'k8s-manifest',
  name: 'Kubernetes manifest validator',
  description:
    'Validate multi-document Kubernetes YAML against the official API schemas, with best-practice hints and starter templates.',
  category: 'development',
  group: 'generators',
  keywords: [
    'kubernetes',
    'k8s',
    'manifest',
    'yaml',
    'validate',
    'lint',
    'schema',
    'deployment',
    'kubectl',
    'kubeval',
    'kubeconform',
  ],
  tags: ['kubernetes', 'yaml'],
  added: '2026-10-24',
  heavy: true,
  examples: [
    {
      input: 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  LOG_LEVEL: info\n',
      expect: '1 document valid',
    },
  ],
};

export default meta;
