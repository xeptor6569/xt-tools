// Encrypts off the main thread. Chunks stay inside this worker.
import { expose } from '../../lib/worker-rpc.ts';
import { decryptBytes, encryptBytes, fileEncrypt } from './logic.ts';

expose({ fileEncrypt, encryptBytes, decryptBytes });
