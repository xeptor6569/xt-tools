// Colour themes for code-to-image, by token group, and the image backgrounds.
// Palettes are original to this project.

export type TokenGroup =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'function'
  | 'type'
  | 'operator'
  | 'punctuation'
  | 'property'
  | 'tag'
  | 'variable'
  | 'regex'
  | 'inserted'
  | 'deleted'
  | 'important';

export interface Theme {
  id: string;
  label: string;
  dark: boolean;
  /** Window background. */
  bg: string;
  /** Default text colour. */
  fg: string;
  lineNumber: string;
  title: string;
  /** The three window-bar dots. */
  dots: readonly [string, string, string];
  colors: Partial<Record<TokenGroup, string>>;
}

const TRAFFIC = ['#ff5f57', '#febc2e', '#28c840'] as const;

export const THEMES = [
  {
    id: 'midnight',
    label: 'Midnight (dark)',
    dark: true,
    bg: '#1b1f2a',
    fg: '#d6deeb',
    lineNumber: '#6b7590',
    title: '#a6accd',
    dots: TRAFFIC,
    colors: {
      comment: '#7f8ba3',
      keyword: '#c792ea',
      string: '#addb67',
      number: '#f78c6c',
      function: '#82aaff',
      type: '#ffcb6b',
      operator: '#89ddff',
      punctuation: '#a6accd',
      property: '#80cbc4',
      tag: '#f07178',
      variable: '#eeffff',
      regex: '#f4a261',
      inserted: '#addb67',
      deleted: '#f07178',
      important: '#ffcb6b',
    },
  },
  {
    id: 'daylight',
    label: 'Daylight (light)',
    dark: false,
    bg: '#ffffff',
    fg: '#24292f',
    lineNumber: '#8c959f',
    title: '#57606a',
    dots: TRAFFIC,
    colors: {
      comment: '#6e7781',
      keyword: '#a626a4',
      string: '#1a7f37',
      number: '#b35900',
      function: '#0550ae',
      type: '#8250df',
      operator: '#0e7490',
      punctuation: '#57606a',
      property: '#0a6c74',
      tag: '#cf222e',
      variable: '#953800',
      regex: '#116329',
      inserted: '#1a7f37',
      deleted: '#cf222e',
      important: '#953800',
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    dark: true,
    bg: '#000000',
    fg: '#ffffff',
    lineNumber: '#c0c0c0',
    title: '#ffffff',
    dots: TRAFFIC,
    colors: {
      comment: '#c0c0c0',
      keyword: '#ffd700',
      string: '#7cff6b',
      number: '#ff9e64',
      function: '#6cf2ff',
      type: '#ffa1ff',
      operator: '#ffffff',
      punctuation: '#ffffff',
      property: '#8fd3ff',
      tag: '#ff8a8a',
      variable: '#ffffff',
      regex: '#ffb86b',
      inserted: '#7cff6b',
      deleted: '#ff8a8a',
      important: '#ffd700',
    },
  },
  {
    id: 'dusk',
    label: 'Dusk (dark)',
    dark: true,
    bg: '#2a2139',
    fg: '#f2e9ff',
    lineNumber: '#8a7aa8',
    title: '#c8b8e8',
    dots: TRAFFIC,
    colors: {
      comment: '#9d8fbf',
      keyword: '#ff7edb',
      string: '#ffd479',
      number: '#f97e72',
      function: '#36f9f6',
      type: '#fede5d',
      operator: '#ff9be8',
      punctuation: '#c8b8e8',
      property: '#72f1b8',
      tag: '#ff6b9a',
      variable: '#f2e9ff',
      regex: '#ffb86b',
      inserted: '#72f1b8',
      deleted: '#ff6b9a',
      important: '#fede5d',
    },
  },
  {
    id: 'paper',
    label: 'Paper (light)',
    dark: false,
    bg: '#fbf6e9',
    fg: '#3b3227',
    lineNumber: '#9a8f7c',
    title: '#6b604f',
    dots: TRAFFIC,
    colors: {
      comment: '#7d725f',
      keyword: '#9b2c5c',
      string: '#2e6b1f',
      number: '#a14a00',
      function: '#1f5fa8',
      type: '#7a3fa0',
      operator: '#8a4b0f',
      punctuation: '#5c5346',
      property: '#0f6a6a',
      tag: '#b0302a',
      variable: '#6a3d00',
      regex: '#2e6b1f',
      inserted: '#2e6b1f',
      deleted: '#b0302a',
      important: '#a14a00',
    },
  },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]['id'];

export function findTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type Fill =
  | { type: 'solid'; color: string }
  /** Linear gradient across the whole area at `angle` degrees (0 = left to right, 90 = top to bottom). */
  | { type: 'linear'; angle: number; stops: ReadonlyArray<readonly [number, string]> };

interface Background {
  id: string;
  label: string;
  stops?: ReadonlyArray<readonly [number, string]>;
}

export const BACKGROUNDS = [
  {
    id: 'ocean',
    label: 'Ocean gradient',
    stops: [
      [0, '#0ea5e9'],
      [1, '#6366f1'],
    ],
  },
  {
    id: 'sunset',
    label: 'Sunset gradient',
    stops: [
      [0, '#f97316'],
      [1, '#db2777'],
    ],
  },
  {
    id: 'forest',
    label: 'Forest gradient',
    stops: [
      [0, '#34d399'],
      [1, '#0f766e'],
    ],
  },
  {
    id: 'candy',
    label: 'Candy gradient',
    stops: [
      [0, '#f472b6'],
      [0.5, '#a78bfa'],
      [1, '#60a5fa'],
    ],
  },
  {
    id: 'slate',
    label: 'Slate gradient',
    stops: [
      [0, '#475569'],
      [1, '#0f172a'],
    ],
  },
  { id: 'theme', label: 'Theme colour' },
  { id: 'transparent', label: 'Transparent' },
] as const satisfies readonly Background[];

export type BackgroundId = (typeof BACKGROUNDS)[number]['id'];

/** Fill for the area around the window, or undefined for a transparent image. */
export function backgroundFill(id: string, theme: Theme): Fill | undefined {
  if (id === 'transparent') return undefined;
  const bg: Background | undefined = BACKGROUNDS.find((b) => b.id === id);
  if (!bg?.stops) return { type: 'solid', color: theme.bg };
  return { type: 'linear', angle: 45, stops: bg.stops };
}
