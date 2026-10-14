// Runs tool logic and turns exceptions into a message for inline display.
import { isToolInputError } from '../tools/types.ts';

export interface ToolResult<T> {
  output: T | undefined;
  error: string | undefined;
}

export const UNEXPECTED_ERROR = 'Something went wrong while processing this input. Please report it as a bug.';

export function errorMessage(error: unknown): string {
  if (isToolInputError(error)) return error.message;
  console.error(error);
  return UNEXPECTED_ERROR;
}

export function runTool<T>(fn: () => T): ToolResult<T> {
  try {
    return { output: fn(), error: undefined };
  } catch (error) {
    return { output: undefined, error: errorMessage(error) };
  }
}
