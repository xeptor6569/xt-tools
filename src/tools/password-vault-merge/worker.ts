// Runs Password vault merge off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { mergeVaultSources, passwordVaultMerge, type MergeSourceInput } from './logic.ts';

expose({
  passwordVaultMerge,
  mergeVaultSources: (sources: MergeSourceInput[], choices?: Record<string, string>) =>
    mergeVaultSources(sources, choices ?? {}),
});
