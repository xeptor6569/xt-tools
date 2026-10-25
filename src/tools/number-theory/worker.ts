// Runs Number theory off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { numberTheory } from './logic.ts';

expose({ numberTheory });
