// Runs Code minifier off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { codeMinifier } from './logic.ts';

expose({ codeMinifier });
