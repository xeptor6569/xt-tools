// Runs user patterns off the main thread. A catastrophic pattern only hangs
// this worker, which the UI terminates after a timeout.
import { expose } from '../../lib/worker-rpc.ts';
import { regexTest } from './logic.ts';

expose({ regexTest });
