// Runs Math evaluator off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { mathEvaluator } from './logic.ts';

expose({ mathEvaluator });
