// The tool contract. See PLAN.md section 5.
import type { CategoryId } from '../categories.ts';
import type { Capability } from '../capabilities.ts';

export interface ToolExample {
  /** Typed into the primary input. */
  input: string;
  /** Substring that must appear in the primary output. */
  expect: string;
}

export interface ToolMeta {
  /** kebab-case, 2–40 chars, equals the folder name. */
  id: string;
  /** Display name, 2–40 chars. Also the page <h1>. */
  name: string;
  /** One sentence, 20–160 chars, ending with a period. Used on cards and in <meta>. */
  description: string;
  category: CategoryId;
  /**
   * Curated sub-collection. Required when the category defines groups, and
   * forbidden otherwise. See `groups` in `src/categories.ts`.
   */
  group?: string;
  /** At least one, lowercase. Old names of merged tools go here. */
  keywords: string[];
  /** ISO date (YYYY-MM-DD). Drives the "New" badge. */
  added: string;
  /** Handles secrets: no URL state, no persistence, private inputs. */
  sensitive?: boolean;
  requires?: Capability[];
  /** Lazy-loads WASM or large data and shows a loading state. */
  heavy?: boolean;
  /** Tool-level legacy warning. Per-algorithm warnings live in the UI. */
  legacy?: string;
  /**
   * Contacts these HTTPS origins when the user runs the tool. Every origin
   * must be listed in `src/lib/network-allow.ts`. Nothing is sent on page load.
   */
  network?: { hosts: string[] };
  examples?: ToolExample[];
}

/**
 * Thrown by logic functions for problems with the user's input. The UI shows
 * the message inline. Any other exception is treated as a bug.
 */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export function isToolInputError(error: unknown): error is ToolInputError {
  return error instanceof Error && error.name === 'ToolInputError';
}
