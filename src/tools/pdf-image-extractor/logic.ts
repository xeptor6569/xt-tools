import { base64 } from '@scure/base';
import pako from 'pako';
import { decodePDFRawStream, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import { crc32 } from '../hash-text/checksums.ts';
import { ToolInputError } from '../types.ts';

const MAX_TEXT = 2_000_000;
const MAX_PDF_BYTES = 64 * 1024 * 1024;

export interface ExtractedPdfImage {
  index: number;
  objectRef: string;
  width: number;
  height: number;
  colorSpace: string;
  filter: string;
  format: 'jpeg' | 'png' | 'jp2';
  mime: string;
  filename: string;
  bytes: Uint8Array;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(4 + data.length);
  body.set(typeBytes, 0);
  body.set(data, 4);
  const crc = crc32(body);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32be(data.length), 0);
  out.set(body, 4);
  out.set(u32be(crc), 4 + body.length);
  return out;
}

/**
 * Encodes 8-bit Gray (1 ch), RGB (3 ch) or RGBA (4 ch) raw scanlines into a PNG.
 */
export function encodeRawToPng(width: number, height: number, channels: 1 | 3 | 4, pixels: Uint8Array): Uint8Array {
  const rowBytes = width * channels;
  if (pixels.length < rowBytes * height) {
    throw new ToolInputError(
      `Decoded image stream (${pixels.length} bytes) is shorter than ${width}×${height}×${channels}.`,
    );
  }
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter type 0 (None)
    raw.set(pixels.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  const compressed = pako.deflate(raw);
  const colorType = channels === 1 ? 0 : channels === 3 ? 2 : 6;
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = pngChunk('IHDR', ihdr);
  const cIdat = pngChunk('IDAT', compressed);
  const cIend = pngChunk('IEND', new Uint8Array(0));
  const out = new Uint8Array(signature.length + cIhdr.length + cIdat.length + cIend.length);
  let off = 0;
  for (const part of [signature, cIhdr, cIdat, cIend]) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

function numberOf(value: unknown): number {
  if (value instanceof PDFNumber) return value.asNumber();
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extracts embedded Image XObjects from a PDF byte buffer.
 * JPEG (/DCTDecode) streams are extracted without re-encoding; Flate streams are packed into PNG.
 */
export async function extractImagesFromPdf(pdfBytes: Uint8Array): Promise<{
  summary: string;
  images: ExtractedPdfImage[];
}> {
  if (pdfBytes.length > MAX_PDF_BYTES) throw new ToolInputError('PDF file exceeds the 64 MB limit.');
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (error) {
    throw new ToolInputError(
      error instanceof Error ? `Could not read PDF: ${error.message}` : 'That file is not a valid PDF.',
    );
  }

  const objects = doc.context.enumerateIndirectObjects();
  const smaskRefs = new Set<string>();
  const streamsByRef = new Map<string, PDFRawStream>();

  for (const [ref, obj] of objects) {
    if (obj instanceof PDFRawStream) {
      streamsByRef.set(ref.toString(), obj);
      const smask = obj.dict.get(PDFName.of('SMask'));
      if (smask instanceof PDFRef) smaskRefs.add(smask.toString());
    }
  }

  const images: ExtractedPdfImage[] = [];
  for (const [ref, obj] of objects) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (smaskRefs.has(ref.toString())) continue;
    const subtype = obj.dict.lookup(PDFName.of('Subtype'));
    if (subtype !== PDFName.of('Image')) continue;

    const width = numberOf(obj.dict.lookup(PDFName.of('Width')));
    const height = numberOf(obj.dict.lookup(PDFName.of('Height')));
    if (width < 1 || height < 1) continue;

    const csObj = obj.dict.lookup(PDFName.of('ColorSpace'));
    const colorSpace = csObj ? String(csObj).replace(/^\//, '') : 'DeviceRGB';
    const filterObj = obj.dict.lookup(PDFName.of('Filter'));
    const filter = filterObj ? String(filterObj).replace(/^[[\s/]+|[\]\s]+$/g, '') : 'Raw';
    const index = images.length + 1;

    if (filter.includes('DCTDecode')) {
      images.push({
        index,
        objectRef: ref.toString(),
        width,
        height,
        colorSpace,
        filter: 'DCTDecode',
        format: 'jpeg',
        mime: 'image/jpeg',
        filename: `image-${index}.jpg`,
        bytes: new Uint8Array(obj.contents),
      });
      continue;
    }

    if (filter.includes('JPXDecode')) {
      images.push({
        index,
        objectRef: ref.toString(),
        width,
        height,
        colorSpace,
        filter: 'JPXDecode',
        format: 'jp2',
        mime: 'image/jp2',
        filename: `image-${index}.jp2`,
        bytes: new Uint8Array(obj.contents),
      });
      continue;
    }

    // Decode Flate or raw stream and pack as PNG
    try {
      const decoded = decodePDFRawStream(obj).decode();
      const smaskRef = obj.dict.get(PDFName.of('SMask'));
      const smaskStream = smaskRef instanceof PDFRef ? streamsByRef.get(smaskRef.toString()) : undefined;
      const alpha = smaskStream ? decodePDFRawStream(smaskStream).decode() : undefined;

      const pixelCount = width * height;
      let pngBytes: Uint8Array;
      if (colorSpace.includes('Gray') && decoded.length >= pixelCount) {
        pngBytes = encodeRawToPng(width, height, 1, decoded);
      } else if (decoded.length >= pixelCount * 3 && alpha && alpha.length >= pixelCount) {
        const rgba = new Uint8Array(pixelCount * 4);
        for (let i = 0; i < pixelCount; i++) {
          rgba[i * 4] = decoded[i * 3]!;
          rgba[i * 4 + 1] = decoded[i * 3 + 1]!;
          rgba[i * 4 + 2] = decoded[i * 3 + 2]!;
          rgba[i * 4 + 3] = alpha[i]!;
        }
        pngBytes = encodeRawToPng(width, height, 4, rgba);
      } else if (decoded.length >= pixelCount * 3) {
        pngBytes = encodeRawToPng(width, height, 3, decoded);
      } else {
        continue;
      }

      images.push({
        index,
        objectRef: ref.toString(),
        width,
        height,
        colorSpace,
        filter: filter || 'FlateDecode',
        format: 'png',
        mime: 'image/png',
        filename: `image-${index}.png`,
        bytes: pngBytes,
      });
    } catch {
      // Unsupported filter or truncated stream; skip gracefully.
    }
  }

  if (images.length === 0) {
    return {
      summary: 'No extractable embedded images (/Subtype /Image) were found in this PDF.',
      images: [],
    };
  }

  const lines = images.map(
    (img) =>
      `#${img.index} (${img.objectRef}): ${img.width}×${img.height} ${img.colorSpace} [${img.filter}] → ${img.filename} (${img.bytes.length.toLocaleString('en')} bytes)`,
  );
  return {
    summary: `Extracted ${images.length} image(s):\n${lines.join('\n')}`,
    images,
  };
}

/**
 * Inspects a PDF Image XObject dictionary snippet or Base64-encoded PDF.
 */
export async function pdfImageExtractor(input: string): Promise<string> {
  if (input.length > MAX_TEXT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';

  if (trimmed.startsWith('JVBERi0')) {
    try {
      const bytes = base64.decode(trimmed.replace(/\s+/g, ''));
      return (await extractImagesFromPdf(bytes)).summary;
    } catch (error) {
      if (error instanceof ToolInputError) throw error;
      throw new ToolInputError('Invalid Base64 PDF data.');
    }
  }

  const matches = [...trimmed.matchAll(/<<([\s\S]*?)>>/g)];
  const found: string[] = [];
  for (const m of matches) {
    const body = m[1]!;
    if (!/\/Subtype\s*\/Image\b/.test(body)) continue;
    const width = Number(/\/Width\s+(\d+)/.exec(body)?.[1] ?? 0);
    const height = Number(/\/Height\s+(\d+)/.exec(body)?.[1] ?? 0);
    if (width < 1 || height < 1) throw new ToolInputError('Image XObject is missing valid /Width or /Height.');
    const cs = /\/ColorSpace\s*\/([A-Za-z0-9]+)/.exec(body)?.[1] ?? 'DeviceRGB';
    const filter = /\/Filter\s*\/([A-Za-z0-9]+)/.exec(body)?.[1] ?? 'FlateDecode';
    const ext = filter === 'DCTDecode' ? 'jpg' : filter === 'JPXDecode' ? 'jp2' : 'png';
    found.push(`#${found.length + 1}: ${width}×${height} ${cs} [${filter}] → image-${found.length + 1}.${ext}`);
  }
  if (found.length === 0) {
    throw new ToolInputError('Paste a PDF /Subtype /Image XObject dictionary or Base64 PDF, or drop a PDF file above.');
  }
  return `Detected ${found.length} image XObject(s):\n${found.join('\n')}`;
}

/**
 * Creates a sample PDF containing two embedded PNG images for testing extraction.
 */
export async function createSamplePdfWithImages(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([320, 200]);

  const w1 = 24;
  const h1 = 16;
  const rgb1 = new Uint8Array(w1 * h1 * 3);
  for (let i = 0; i < w1 * h1; i++) {
    rgb1[i * 3] = 29;
    rgb1[i * 3 + 1] = 78;
    rgb1[i * 3 + 2] = 216;
  }
  const png1 = encodeRawToPng(w1, h1, 3, rgb1);

  const w2 = 16;
  const h2 = 16;
  const rgb2 = new Uint8Array(w2 * h2 * 3);
  for (let i = 0; i < w2 * h2; i++) {
    rgb2[i * 3] = 16;
    rgb2[i * 3 + 1] = 185;
    rgb2[i * 3 + 2] = 129;
  }
  const png2 = encodeRawToPng(w2, h2, 3, rgb2);

  const img1 = await doc.embedPng(png1);
  const img2 = await doc.embedPng(png2);
  page.drawImage(img1, { x: 24, y: 80, width: 96, height: 64 });
  page.drawImage(img2, { x: 150, y: 80, width: 64, height: 64 });

  return await doc.save();
}
