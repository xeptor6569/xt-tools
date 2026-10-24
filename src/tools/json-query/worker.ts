// Evaluates JSONPath queries off the main thread, so a slow query never freezes the page.
import { expose } from '../../lib/worker-rpc.ts';
import { jsonQuery } from './logic.ts';

expose({ jsonQuery });
