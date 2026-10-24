// Must be evaluated before prism-core: Prism reads these flags from the global
// object when it loads. `manual` stops it from highlighting the whole page on
// its own, and `disableWorkerMessageHandler` stops it from listening to
// messages if it ever runs inside a worker.
interface PrismFlags {
  manual?: boolean;
  disableWorkerMessageHandler?: boolean;
}

const scope = globalThis as { Prism?: PrismFlags };
scope.Prism ??= {};
scope.Prism.manual = true;
scope.Prism.disableWorkerMessageHandler = true;

export {};
