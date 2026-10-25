// Runs CSV editor off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { csvEditor, csvTextTable, deleteEmptyRows, transposeCsv } from './logic.ts';

expose({ csvEditor, csvTextTable, deleteEmptyRows, transposeCsv });
