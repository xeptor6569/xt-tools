import figlet from 'figlet';
import { ToolInputError } from '../types.ts';

export type Layout = 'default' | 'full' | 'fitted';

const MAX_INPUT = 500;
const loaded = new Set<string>();

// Never let figlet fetch a missing font from the network.
figlet.defaults({ fetchFontIfMissing: false });

/** Renders text with a FIGlet font whose .flf data has already been loaded. */
export function asciiArt(
  text: string,
  font: string,
  fontData: string,
  { layout = 'default' as Layout, width = 80 } = {},
): string {
  if (text.length > MAX_INPUT)
    throw new ToolInputError(`Text is too long for ASCII art (maximum ${MAX_INPUT} characters).`);
  if (text.trim() === '') return '';
  if (!loaded.has(font)) {
    figlet.parseFont(font, fontData);
    loaded.add(font);
  }
  try {
    return figlet
      .textSync(text, {
        font,
        horizontalLayout: layout,
        width: Math.min(400, Math.max(20, width)),
        whitespaceBreak: true,
      })
      .replace(/[ \t]+$/gm, '');
  } catch (error) {
    throw new ToolInputError(`This font can't render that text: ${(error as Error).message}`);
  }
}
