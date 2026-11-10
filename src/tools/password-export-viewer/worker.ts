// Runs Password export viewer & converter off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { buildSampleKdbx4, inspectAndConvertVault, passwordExportViewer, type InspectVaultOptions } from './logic.ts';

expose({
  passwordExportViewer,
  inspectAndConvertVault: (input: string, options?: InspectVaultOptions) => inspectAndConvertVault(input, options),
  buildSampleKdbx4,
});
