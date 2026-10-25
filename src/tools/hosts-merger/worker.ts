// Runs Hosts merger off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { hostsMerger } from './logic.ts';

expose({ hostsMerger });
