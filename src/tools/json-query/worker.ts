// Evaluates JSONPath and jq WASM queries off the main thread, so a slow query never freezes the page.
import jqWasmUrl from 'jq-web/jq.wasm?url';
import { resolveLocalAsset } from '../../lib/load-local-asset.ts';
import { expose } from '../../lib/worker-rpc.ts';
import { jqQuery, jsonQuery } from './logic.ts';

expose({
  jsonQuery,
  jqQuery: (input: string, filter: string, maxResults?: number) =>
    jqQuery(input, filter, maxResults, resolveLocalAsset(jqWasmUrl).href),
});
