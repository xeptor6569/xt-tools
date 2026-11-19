// Markdown → .docx. The file is Office Open XML (a zip of XML) built in the
// browser, with no network and no extra library. Remote images are not
// embedded, so Word has nothing to fetch. data: images are stored in the file.
import type { Token, Tokens } from 'marked';
import { markdownTokens } from './logic.ts';

const PAGE_WIDTH = 12240;
const MARGIN = 1134;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MAX_IMAGE_BYTES = 4_000_000;

interface Marks {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
}

interface OrderedNum {
  id: number;
  ilvl: number;
  start: number;
}

interface Rel {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

interface Media {
  name: string;
  ext: string;
  data: Uint8Array;
}

interface DocState {
  rels: Rel[];
  media: Media[];
  ordered: OrderedNum[];
  nextRid: number;
  nextNum: number;
  nextDrawing: number;
}

const emptyMarks = (): Marks => ({ bold: false, italic: false, strike: false, code: false, link: false });

function xmlText(value: string): string {
  let cleaned = value;
  let cut = false;
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      cut = true;
      if (i > start) parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  if (cut) {
    if (start < value.length) parts.push(value.slice(start));
    cleaned = parts.join('');
  }
  return cleaned.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlAttr(value: string): string {
  return xmlText(value).replace(/"/g, '&quot;');
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Zip with the store method. Word opens it, and the XML stays readable in tests. */
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, file.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const central = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, offset, true);
  return concat([...parts, central, end]);
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function safeHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (!/^(https?:|mailto:)/i.test(trimmed) || /\s/.test(trimmed)) return undefined;
  for (const char of trimmed) {
    if ((char.codePointAt(0) ?? 0) < 32) return undefined;
  }
  return trimmed;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    });
}

function runProps(marks: Marks): string {
  const parts: string[] = [];
  if (marks.link) parts.push('<w:rStyle w:val="Hyperlink"/>');
  if (marks.bold) parts.push('<w:b/><w:bCs/>');
  if (marks.italic) parts.push('<w:i/><w:iCs/>');
  if (marks.strike) parts.push('<w:strike/>');
  if (marks.code) {
    parts.push(
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>',
      '<w:sz w:val="20"/><w:szCs w:val="20"/>',
      '<w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>',
      '<w:noProof/>',
    );
  }
  return parts.length > 0 ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
}

function run(text: string, marks: Marks): string {
  if (text === '') return '';
  const space = /^\s|\s$|\s{2}/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:r>${runProps(marks)}<w:t${space}>${xmlText(text)}</w:t></w:r>`;
}

function paragraph(
  inner: string,
  options: { style?: string; numId?: number; ilvl?: number; align?: string; indent?: number } = {},
): string {
  const props: string[] = [];
  if (options.style) props.push(`<w:pStyle w:val="${options.style}"/>`);
  if (options.align) props.push(`<w:jc w:val="${options.align}"/>`);
  if (options.numId !== undefined) {
    props.push(`<w:numPr><w:ilvl w:val="${options.ilvl ?? 0}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
  } else if (options.indent) {
    props.push(`<w:ind w:left="${options.indent}"/>`);
  }
  return `<w:p>${props.length > 0 ? `<w:pPr>${props.join('')}</w:pPr>` : ''}${inner}</w:p>`;
}

function isBlock(token: Token): boolean {
  if (token.type === 'html') return Boolean((token as Tokens.HTML).block);
  return (
    token.type === 'space' ||
    token.type === 'heading' ||
    token.type === 'paragraph' ||
    token.type === 'blockquote' ||
    token.type === 'code' ||
    token.type === 'list' ||
    token.type === 'table' ||
    token.type === 'hr'
  );
}

function addRel(state: DocState, type: string, target: string, external: boolean): string {
  const id = `rId${state.nextRid++}`;
  state.rels.push({ id, type, target, external });
  return id;
}

function decodeDataImage(href: string): { ext: string; data: Uint8Array } | undefined {
  const match = /^data:image\/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(href.trim());
  if (!match) return undefined;
  const ext = match[1]!.toLowerCase() === 'jpg' ? 'jpeg' : match[1]!.toLowerCase();
  const b64 = match[2]!.replace(/\s/g, '');
  if (b64.length > MAX_IMAGE_BYTES * 2) return undefined;
  try {
    const binary = atob(b64);
    if (binary.length > MAX_IMAGE_BYTES) return undefined;
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    return { ext, data };
  } catch {
    return undefined;
  }
}

function imagePixels(ext: string, bytes: Uint8Array): { w: number; h: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ext === 'png' && bytes.length >= 24 && bytes[0] === 0x89) {
    return { w: view.getUint32(16), h: view.getUint32(20) };
  }
  if (ext === 'gif' && bytes.length >= 10 && bytes[0] === 0x47) {
    return { w: view.getUint16(6, true), h: view.getUint16(8, true) };
  }
  if (ext === 'jpeg') {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1] ?? 0;
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { h: view.getUint16(i + 5), w: view.getUint16(i + 7) };
      }
      const length = view.getUint16(i + 2);
      if (length < 2) break;
      i += 2 + length;
    }
  }
  return undefined;
}

function drawing(state: DocState, ext: string, data: Uint8Array): string {
  const id = state.nextDrawing++;
  const name = `media/image${id}.${ext}`;
  state.media.push({ name, ext, data });
  const rel = addRel(state, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', name, false);
  const pixels = imagePixels(ext, data) ?? { w: 320, h: 180 };
  const maxCx = Math.round(6.5 * 914400);
  let cx = Math.max(1, pixels.w) * 9525;
  let cy = Math.max(1, pixels.h) * 9525;
  if (cx > maxCx) {
    cy = Math.max(1, Math.round((cy * maxCx) / cx));
    cx = maxCx;
  }
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="Picture ${id}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image${id}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

function inlines(state: DocState, tokens: Token[] | undefined, marks: Marks): string {
  if (!tokens) return '';
  let out = '';
  for (const token of tokens) out += inline(state, token, marks);
  return out;
}

function inline(state: DocState, token: Token, marks: Marks): string {
  switch (token.type) {
    case 'text':
    case 'escape': {
      const text = token as Tokens.Text;
      if (text.tokens && text.tokens.length > 0) return inlines(state, text.tokens, marks);
      return run(text.text, marks);
    }
    case 'strong':
      return inlines(state, (token as Tokens.Strong).tokens, { ...marks, bold: true });
    case 'em':
      return inlines(state, (token as Tokens.Em).tokens, { ...marks, italic: true });
    case 'del':
      return inlines(state, (token as Tokens.Del).tokens, { ...marks, strike: true });
    case 'codespan':
      return run((token as Tokens.Codespan).text, { ...marks, code: true });
    case 'br':
      return '<w:r><w:br/></w:r>';
    case 'checkbox':
      return run((token as Tokens.Checkbox).checked ? '☑ ' : '☐ ', marks);
    case 'link': {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      const body = inlines(state, link.tokens, { ...marks, link: href !== undefined });
      if (!href) return body;
      const id = addRel(
        state,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        href,
        true,
      );
      return `<w:hyperlink r:id="${id}">${body}</w:hyperlink>`;
    }
    case 'image': {
      const image = token as Tokens.Image;
      const embedded = image.href.startsWith('data:') ? decodeDataImage(image.href) : undefined;
      if (embedded) return drawing(state, embedded.ext, embedded.data);
      const alt = image.text.trim();
      return run(alt || '[external image blocked]', { ...marks, italic: true });
    }
    case 'html': {
      const text = htmlToText((token as Tokens.HTML).text);
      if (!text) return '';
      return text
        .split('\n')
        .map((line, index) => `${index > 0 ? '<w:r><w:br/></w:r>' : ''}${run(line, marks)}`)
        .join('');
    }
    default:
      return '';
  }
}

function renderBlocks(state: DocState, tokens: Token[], indent = 0): string {
  let out = '';
  for (const token of tokens) {
    if (token.type === 'space') continue;
    out += renderBlock(state, token, indent);
  }
  return out;
}

function renderBlock(state: DocState, token: Token, indent: number): string {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      const depth = Math.min(6, Math.max(1, heading.depth));
      return paragraph(inlines(state, heading.tokens, emptyMarks()), {
        style: `Heading${depth}`,
        indent: indent || undefined,
      });
    }
    case 'paragraph':
      return paragraph(inlines(state, (token as Tokens.Paragraph).tokens, emptyMarks()), {
        indent: indent || undefined,
      });
    case 'blockquote':
      return (token as Tokens.Blockquote).tokens
        .map((child) => {
          if (child.type === 'paragraph') {
            return paragraph(inlines(state, (child as Tokens.Paragraph).tokens, emptyMarks()), {
              style: 'Quote',
              indent: indent ? 360 + indent : undefined,
            });
          }
          return renderBlock(state, child, indent + 360);
        })
        .join('');
    case 'code': {
      const lines = (token as Tokens.Code).text.split('\n');
      return lines
        .map((line, index) =>
          paragraph(run(line, emptyMarks()), {
            style: index === 0 ? 'CodeBlock' : 'CodeBlockNext',
            indent: indent || undefined,
          }),
        )
        .join('');
    }
    case 'hr':
      return `<w:p><w:pPr>${indent ? `<w:ind w:left="${indent}"/>` : ''}<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="D1D5DB"/></w:pBdr></w:pPr></w:p>`;
    case 'list':
      return renderList(state, token as Tokens.List, 0);
    case 'table':
      return renderTable(state, token as Tokens.Table);
    case 'html': {
      const text = htmlToText((token as Tokens.HTML).text).trim();
      return text ? paragraph(run(text, emptyMarks()), { indent: indent || undefined }) : '';
    }
    default:
      return '';
  }
}

function renderList(
  state: DocState,
  list: Tokens.List,
  ilvl: number,
  parent?: { ordered: boolean; numId: number },
): string {
  const start = typeof list.start === 'number' ? list.start : 1;
  let numId: number;
  if (!list.ordered) {
    numId = 1;
  } else if (parent?.ordered && start === 1) {
    numId = parent.numId;
  } else {
    numId = state.nextNum++;
    state.ordered.push({ id: numId, ilvl, start });
  }
  return list.items.map((item) => renderItem(state, item, ilvl, numId, list.ordered)).join('');
}

function renderItem(state: DocState, item: Tokens.ListItem, ilvl: number, numId: number, ordered: boolean): string {
  let out = '';
  let marked = false;
  const pending: Token[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    out += paragraph(inlines(state, pending.splice(0), emptyMarks()), marker(marked, numId, ilvl));
    marked = true;
  };
  for (const token of item.tokens) {
    if (token.type === 'space') {
      flush();
      continue;
    }
    if (token.type === 'list') {
      flush();
      out += renderList(state, token as Tokens.List, ilvl + 1, { ordered, numId });
      marked = true;
      continue;
    }
    if (token.type === 'paragraph') {
      flush();
      out += paragraph(inlines(state, (token as Tokens.Paragraph).tokens, emptyMarks()), marker(marked, numId, ilvl));
      marked = true;
      continue;
    }
    if (isBlock(token)) {
      flush();
      out += renderBlock(state, token, 720 * (ilvl + 1));
      marked = true;
      continue;
    }
    pending.push(token);
  }
  flush();
  if (!marked) out += paragraph('', { numId, ilvl });
  return out;
}

function marker(
  alreadyMarked: boolean,
  numId: number,
  ilvl: number,
): { numId?: number; ilvl?: number; indent?: number } {
  if (!alreadyMarked) return { numId, ilvl };
  return { indent: 720 * (ilvl + 1) };
}

const CELL_BORDER = (edge: string) => `<w:${edge} w:val="single" w:sz="8" w:space="0" w:color="D1D5DB"/>`;

function renderTable(state: DocState, table: Tokens.Table): string {
  const columns = table.header.length;
  if (columns === 0) return '';
  const base = Math.floor(CONTENT_WIDTH / columns);
  const widths = table.header.map((_, index) => (index === columns - 1 ? CONTENT_WIDTH - base * (columns - 1) : base));
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('');
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(CELL_BORDER).join('');
  const rows = [table.header, ...table.rows].map((row, rowIndex) => {
    const header = rowIndex === 0;
    const cells = row
      .map((cell, index) => {
        const align = cell.align === 'center' || cell.align === 'right' ? cell.align : undefined;
        const body = paragraph(inlines(state, cell.tokens, { ...emptyMarks(), bold: header }), { align });
        const shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : '';
        return (
          `<w:tc><w:tcPr><w:tcW w:w="${widths[index] ?? base}" w:type="dxa"/>${shade}` +
          `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map(CELL_BORDER).join('')}</w:tcBorders></w:tcPr>${body}</w:tc>`
        );
      })
      .join('');
    const headerRow = header ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
    return `<w:tr>${headerRow}${cells}</w:tr>`;
  });
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/>` +
    `<w:tblBorders>${borders}</w:tblBorders>` +
    `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>` +
    `<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl>`
  );
}

function level(ilvl: number, format: string, text: string): string {
  const left = 720 * (ilvl + 1);
  return (
    `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${format}"/>` +
    `<w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
    `<w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr></w:lvl>`
  );
}

function numberingXml(ordered: OrderedNum[]): string {
  const bullets = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => level(i, 'bullet', ['•', '◦', '▪'][i % 3]!)).join('');
  const formats = ['decimal', 'lowerLetter', 'lowerRoman'];
  const decimals = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => level(i, formats[i % 3]!, `%${i + 1}.`)).join('');
  const instances = [
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>',
    ...ordered.map((num) => {
      const override =
        num.start !== 1
          ? `<w:lvlOverride w:ilvl="${num.ilvl}"><w:startOverride w:val="${num.start}"/></w:lvlOverride>`
          : '';
      return `<w:num w:numId="${num.id}"><w:abstractNumId w:val="1"/>${override}</w:num>`;
    }),
  ];
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decimals}</w:abstractNum>` +
    `${instances.join('')}</w:numbering>`
  );
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
<w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="111827"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="80"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="280" w:after="60"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="40"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Heading4"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Heading4"/><w:qFormat/>
<w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>
<w:rPr><w:color w:val="1D4ED8"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/>
<w:pPr><w:ind w:left="360"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="D1D5DB"/></w:pBdr></w:pPr>
<w:rPr><w:i/><w:color w:val="4B5563"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/>
<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/><w:spacing w:before="80" w:after="0" w:line="240" w:lineRule="auto"/>
<w:ind w:left="120" w:right="120"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:noProof/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CodeBlockNext"><w:name w:val="Code Block Next"/><w:basedOn w:val="CodeBlock"/>
<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:style>
</w:styles>`;

function contentTypes(media: Media[]): string {
  const extras = [...new Set(media.map((item) => item.ext))].map((ext) => {
    const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `<Default Extension="${ext}" ContentType="${type}"/>`;
  });
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>${extras.join('')}` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
    `</Types>`
  );
}

function relationships(rels: Rel[]): string {
  const body = rels
    .map(
      (rel) =>
        `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${xmlAttr(rel.target)}"${rel.external ? ' TargetMode="External"' : ''}/>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`
  );
}

/** A .docx whose headings, emphasis, lists, code and tables follow the Markdown. */
export function markdownToDocx(input: string): Uint8Array {
  const tokens = markdownTokens(input);
  const state: DocState = {
    rels: [
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
        target: 'styles.xml',
        external: false,
      },
      {
        id: 'rId2',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
        target: 'numbering.xml',
        external: false,
      },
    ],
    media: [],
    ordered: [],
    nextRid: 3,
    nextNum: 2,
    nextDrawing: 1,
  };
  const body = renderBlocks(state, tokens);
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${body || '<w:p/>'}` +
    `<w:sectPr><w:pgSz w:w="${PAGE_WIDTH}" w:h="15840"/>` +
    `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="720" w:footer="720" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`;
  const files = [
    { name: '[Content_Types].xml', data: encode(contentTypes(state.media)) },
    {
      name: '_rels/.rels',
      data: encode(
        relationships([
          {
            id: 'rId1',
            type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
            target: 'word/document.xml',
            external: false,
          },
        ]),
      ),
    },
    { name: 'word/document.xml', data: encode(document) },
    { name: 'word/styles.xml', data: encode(STYLES) },
    { name: 'word/numbering.xml', data: encode(numberingXml(state.ordered)) },
    { name: 'word/_rels/document.xml.rels', data: encode(relationships(state.rels)) },
    ...state.media.map((item) => ({ name: `word/${item.name}`, data: item.data })),
  ];
  return zipStore(files);
}
