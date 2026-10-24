// Kept apart from logic.ts so the UI can read them without pulling jsonpath-plus into the page bundle.
export const DEFAULT_MAX_RESULTS = 1000;
export const MAX_RESULT_OPTIONS = [100, 1000, 10_000] as const;
