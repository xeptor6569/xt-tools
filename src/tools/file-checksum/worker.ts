// Hashes off the main thread so a large file never freezes the page.
import { expose } from '../../lib/worker-rpc.ts';
import { checksumBytes, fileChecksum } from './logic.ts';

expose({ fileChecksum, checksumBytes });
