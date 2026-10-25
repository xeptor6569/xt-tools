import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

/**
 * Strips the XML declaration, comments, Inkscape/Sodipodi markup and whitespace
 * between tags. `href` values that are not `data:` or `#…` are removed so the
 * preview cannot fetch them.
 */
export function svgOptimizer(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim().replace(/^\uFEFF/, '');
  if (trimmed === '') return '';
  let out = trimmed;
  out = out.replace(/<\?xml\b[^>]*\?>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = stripMetadata(out);
  out = out.replace(/<\/?(?:sodipodi|inkscape):[\w.-]+\b[^>]*>/gi, '');
  out = out.replace(/(?<![\w:-])(?:xmlns:)?(?:sodipodi|inkscape)(?::[\w.-]+)?\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  out = dropBadHrefs(out);
  out = out.replace(/>\s+</g, '><').trim();
  if (!/<svg\b/i.test(out)) throw new ToolInputError('Paste an SVG document.');
  return out;
}

function stripMetadata(input: string): string {
  return input.replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, (block) =>
    /inkscape|sodipodi/i.test(block) ? '' : block,
  );
}

function dropBadHrefs(svg: string): string {
  return svg.replace(
    /(?<![\w:-])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (full, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
      const value = (doubleQuoted ?? singleQuoted ?? '').trim();
      if (value.startsWith('#') || value.toLowerCase().startsWith('data:')) return full;
      return '';
    },
  );
}
