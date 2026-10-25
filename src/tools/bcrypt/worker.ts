// Runs Bcrypt off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { bcryptHash } from './logic.ts';

expose({ bcrypt: bcryptHash });
