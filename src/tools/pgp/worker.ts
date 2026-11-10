// Runs PGP tool off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { generatePgpKeyPair, pgp } from './logic.ts';

expose({ pgp, generatePgpKeyPair });
