// Hashes off the main thread so large input never freezes the page.
import { expose } from '../../lib/worker-rpc.ts';
import { hashText } from './logic.ts';

expose({ hashText });
