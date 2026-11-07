// Runs Password hash off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { passwordHash } from './logic.ts';

expose({ passwordHash });
