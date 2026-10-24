import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'kubernetes-cheatsheet',
  name: 'Kubernetes cheatsheet',
  description: 'Searchable reference of kubectl commands for pods, deployments, services, logs and debugging.',
  category: 'development',
  group: 'cheatsheets',
  keywords: ['kubernetes', 'k8s', 'kubectl', 'cheatsheet', 'pods', 'deployment', 'jsonpath', 'commands', 'reference'],
  added: '2026-10-24',
  examples: [{ input: 'rollout undo', expect: 'kubectl rollout undo deployment/<name>' }],
};

export default meta;
