import { base64, hex } from '@scure/base';
import { ToolInputError } from '../types.ts';
import {
  algorithmName,
  bitStringPayload,
  concatBytes,
  copyBytes,
  derBitString,
  derInteger,
  derOid,
  derSeq,
  derTag,
  formatName,
  formatTime,
  integerBytes,
  integerHex,
  oidToString,
  parseDer,
  type DerNode,
} from '../x509-decoder/der.ts';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_TEXT = 2_000_000;

export interface PdfSignatureReport {
  index: number;
  subFilter: string;
  signerName?: string;
  reason?: string;
  location?: string;
  signingTime?: string;
  byteRange: [number, number, number, number];
  coversWholeDocument: boolean;
  subject?: string;
  issuer?: string;
  serial?: string;
  notBefore?: string;
  notAfter?: string;
  digestAlgorithm?: string;
  signatureAlgorithm?: string;
  byteRangeDigestMatch?: boolean;
  signatureValid?: boolean;
  status: string;
}

const DIGEST_OIDS: Record<string, 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'> = {
  '1.3.14.3.2.26': 'SHA-1',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
};

const CURVE_OIDS: Record<string, { namedCurve: 'P-256' | 'P-384' | 'P-521'; coordBytes: number }> = {
  '1.2.840.10045.3.1.7': { namedCurve: 'P-256', coordBytes: 32 },
  '1.3.132.0.34': { namedCurve: 'P-384', coordBytes: 48 },
  '1.3.132.0.35': { namedCurve: 'P-521', coordBytes: 66 },
};

function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\([()\\nrt])/g, (_, ch: string) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      return ch;
    })
    .trim();
}

function trimTrailingZeroBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 2 || bytes[0] !== 0x30) return bytes;
  try {
    let p = 1;
    let len = bytes[p++]!;
    if (len & 0x80) {
      const n = len & 0x7f;
      if (n === 0 || n > 4) return bytes;
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + bytes[p++]!;
    }
    const total = p + len;
    if (total <= bytes.length) return bytes.subarray(0, total);
  } catch {
    // Let parseDer report the problem.
  }
  return bytes;
}

function derEcdsaToP1363(derSig: Uint8Array, coordBytes: number): Uint8Array {
  const seq = parseDer(derSig);
  if (seq.tag !== 16 || seq.children.length < 2) throw new ToolInputError('Invalid ECDSA signature DER.');
  const r = integerBytes(seq.children[0]!);
  const s = integerBytes(seq.children[1]!);
  if (r.length > coordBytes || s.length > coordBytes) throw new ToolInputError('ECDSA coordinate exceeds curve size.');
  const out = new Uint8Array(coordBytes * 2);
  out.set(r, coordBytes - r.length);
  out.set(s, coordBytes * 2 - s.length);
  return out;
}

interface ParsedCert {
  subject: string;
  issuer: string;
  serial: string;
  notBefore: string;
  notAfter: string;
  spkiDer: Uint8Array;
  spkiAlgOid: string;
  curveOid?: string;
}

function parseCertificateNode(certNode: DerNode): ParsedCert {
  const tbs = certNode.children[0];
  if (!tbs || tbs.children.length < 6) throw new ToolInputError('Invalid X.509 certificate in CMS SignedData.');
  let i = 0;
  if (tbs.children[0]?.cls === 2 && tbs.children[0].tag === 0) i++;
  const serialNode = tbs.children[i++]!;
  i++; // signature algorithm
  const issuerNode = tbs.children[i++]!;
  const validityNode = tbs.children[i++]!;
  const subjectNode = tbs.children[i++]!;
  const spkiNode = tbs.children[i]!;
  const spkiDer = derTag(0x30, spkiNode.bytes);
  const algSeq = spkiNode.children[0];
  const spkiAlgOid = algSeq?.children[0] ? oidToString(algSeq.children[0].bytes) : '';
  const curveOid = algSeq?.children[1] ? oidToString(algSeq.children[1].bytes) : undefined;
  return {
    subject: formatName(subjectNode),
    issuer: formatName(issuerNode),
    serial: integerHex(serialNode),
    notBefore: formatTime(validityNode.children[0]!),
    notAfter: formatTime(validityNode.children[1]!),
    spkiDer,
    spkiAlgOid,
    ...(curveOid ? { curveOid } : {}),
  };
}

interface ParsedCms {
  cert?: ParsedCert;
  digestAlg?: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
  signatureAlgorithm?: string;
  messageDigestAttr?: Uint8Array;
  signingTime?: string;
  signedAttrsSetDer?: Uint8Array;
  signatureBytes?: Uint8Array;
}

function parseCmsSignedData(cmsDer: Uint8Array): ParsedCms {
  const contentInfo = parseDer(trimTrailingZeroBytes(cmsDer));
  if (contentInfo.tag !== 16 || contentInfo.children.length < 2) {
    throw new ToolInputError('CMS ContentInfo is malformed.');
  }
  const contentType = oidToString(contentInfo.children[0]!.bytes);
  if (contentType !== '1.2.840.113549.1.7.2') {
    throw new ToolInputError(`Unsupported CMS content type ${contentType} (expected signedData).`);
  }
  const signedDataWrapper = contentInfo.children[1]!;
  const signedData = signedDataWrapper.children[0];
  if (!signedData || signedData.tag !== 16) {
    throw new ToolInputError('CMS SignedData is missing.');
  }

  let cert: ParsedCert | undefined;
  let signerInfosNode: DerNode | undefined;
  for (const child of signedData.children) {
    if (child.cls === 2 && child.tag === 0 && child.children.length > 0) {
      cert = parseCertificateNode(child.children[0]!);
    } else if (child.cls === 0 && child.tag === 17) {
      signerInfosNode = child;
    }
  }

  const signerInfo = signerInfosNode?.children[0];
  if (!signerInfo) return { ...(cert ? { cert } : {}) };

  // SignerInfo ::= SEQUENCE { version, sid, digestAlgorithm, signedAttrs [0] IMPLICIT OPTIONAL, signatureAlgorithm, signature, ... }
  let idx = 2;
  const digestAlgNode = signerInfo.children[idx++];
  const digestOid = digestAlgNode?.children[0] ? oidToString(digestAlgNode.children[0].bytes) : '';
  const digestAlg = DIGEST_OIDS[digestOid];

  let signedAttrsSetDer: Uint8Array | undefined;
  let messageDigestAttr: Uint8Array | undefined;
  let signingTime: string | undefined;

  if (signerInfo.children[idx]?.cls === 2 && signerInfo.children[idx]?.tag === 0) {
    const attrsNode = signerInfo.children[idx++]!;
    // Per RFC 5652 section 5.4, the IMPLICIT [0] tag is replaced by SET OF (0x31) for signature verification.
    signedAttrsSetDer = derTag(0x31, attrsNode.bytes);
    for (const attr of attrsNode.children) {
      const attrOid = attr.children[0] ? oidToString(attr.children[0].bytes) : '';
      const attrValues = attr.children[1];
      const firstVal = attrValues?.children[0];
      if (attrOid === '1.2.840.113549.1.9.4' && firstVal) {
        messageDigestAttr = firstVal.bytes;
      } else if (attrOid === '1.2.840.113549.1.9.5' && firstVal) {
        signingTime = formatTime(firstVal);
      }
    }
  }

  const sigAlgNode = signerInfo.children[idx++];
  const signatureAlgorithm = sigAlgNode ? algorithmName(sigAlgNode) : undefined;
  const sigValueNode = signerInfo.children[idx];
  const signatureBytes = sigValueNode?.bytes;

  return {
    ...(cert ? { cert } : {}),
    ...(digestAlg ? { digestAlg } : {}),
    ...(signatureAlgorithm ? { signatureAlgorithm } : {}),
    ...(messageDigestAttr ? { messageDigestAttr } : {}),
    ...(signingTime ? { signingTime } : {}),
    ...(signedAttrsSetDer ? { signedAttrsSetDer } : {}),
    ...(signatureBytes ? { signatureBytes } : {}),
  };
}

async function verifySignatureCrypto(
  pdfBytes: Uint8Array,
  byteRange: [number, number, number, number],
  cms: ParsedCms,
): Promise<{ byteRangeDigestMatch?: boolean; signatureValid?: boolean; note?: string }> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return { note: 'WebCrypto is unavailable in this context; parsed certificate and CMS metadata only.' };
  }
  if (!cms.digestAlg || !cms.cert || !cms.signatureBytes) {
    return { note: 'CMS structure has no verifiable SignerInfo.' };
  }
  const [o1, l1, o2, l2] = byteRange;
  let byteRangeDigestMatch: boolean | undefined;
  let signedBytes: Uint8Array | undefined;

  if (o1 >= 0 && l1 >= 0 && o2 >= o1 + l1 && o2 + l2 <= pdfBytes.length) {
    signedBytes = concatBytes([pdfBytes.subarray(o1, o1 + l1), pdfBytes.subarray(o2, o2 + l2)]);
    if (cms.messageDigestAttr) {
      const digest = new Uint8Array(await subtle.digest(cms.digestAlg, copyBytes(signedBytes)));
      byteRangeDigestMatch =
        digest.length === cms.messageDigestAttr.length && digest.every((b, i) => b === cms.messageDigestAttr![i]);
    }
  }

  const payload = cms.signedAttrsSetDer ?? signedBytes;
  if (!payload) return { ...(byteRangeDigestMatch !== undefined ? { byteRangeDigestMatch } : {}) };

  try {
    if (cms.cert.spkiAlgOid === '1.2.840.113549.1.1.1') {
      const key = await subtle.importKey(
        'spki',
        copyBytes(cms.cert.spkiDer),
        { name: 'RSASSA-PKCS1-v1_5', hash: cms.digestAlg },
        false,
        ['verify'],
      );
      const signatureValid = await subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        copyBytes(cms.signatureBytes),
        copyBytes(payload),
      );
      return {
        ...(byteRangeDigestMatch !== undefined ? { byteRangeDigestMatch } : {}),
        signatureValid,
      };
    }
    if (cms.cert.spkiAlgOid === '1.2.840.10045.2.1') {
      const curve = CURVE_OIDS[cms.cert.curveOid ?? '1.2.840.10045.3.1.7'] ?? {
        namedCurve: 'P-256' as const,
        coordBytes: 32,
      };
      const key = await subtle.importKey(
        'spki',
        copyBytes(cms.cert.spkiDer),
        { name: 'ECDSA', namedCurve: curve.namedCurve },
        false,
        ['verify'],
      );
      const p1363 = derEcdsaToP1363(cms.signatureBytes, curve.coordBytes);
      const signatureValid = await subtle.verify(
        { name: 'ECDSA', hash: cms.digestAlg },
        key,
        copyBytes(p1363),
        copyBytes(payload),
      );
      return {
        ...(byteRangeDigestMatch !== undefined ? { byteRangeDigestMatch } : {}),
        signatureValid,
      };
    }
  } catch {
    return {
      ...(byteRangeDigestMatch !== undefined ? { byteRangeDigestMatch } : {}),
      signatureValid: false,
    };
  }
  return { ...(byteRangeDigestMatch !== undefined ? { byteRangeDigestMatch } : {}) };
}

function formatReport(r: PdfSignatureReport): string {
  const lines = [
    `signature #${r.index}`,
    `status: ${r.status}`,
    `subFilter: ${r.subFilter}`,
    `byteRange: [${r.byteRange.join(', ')}]`,
    `coverage: ${r.coversWholeDocument ? 'entire document' : 'partial (bytes exist outside ByteRange)'}`,
  ];
  if (r.signerName) lines.push(`name: ${r.signerName}`);
  if (r.reason) lines.push(`reason: ${r.reason}`);
  if (r.location) lines.push(`location: ${r.location}`);
  if (r.signingTime) lines.push(`signingTime: ${r.signingTime}`);
  if (r.subject) lines.push(`subject: ${r.subject}`);
  if (r.issuer) lines.push(`issuer: ${r.issuer}`);
  if (r.serial) lines.push(`serial: ${r.serial}`);
  if (r.notBefore) lines.push(`notBefore: ${r.notBefore}`);
  if (r.notAfter) lines.push(`notAfter: ${r.notAfter}`);
  if (r.digestAlgorithm) lines.push(`digestAlgorithm: ${r.digestAlgorithm}`);
  if (r.signatureAlgorithm) lines.push(`signatureAlgorithm: ${r.signatureAlgorithm}`);
  if (r.byteRangeDigestMatch !== undefined) {
    lines.push(`byteRangeDigest: ${r.byteRangeDigestMatch ? 'match' : 'mismatch'}`);
  }
  if (r.signatureValid !== undefined) {
    lines.push(`cryptoVerify: ${r.signatureValid ? 'valid' : 'invalid'}`);
  }
  return lines.join('\n');
}

/**
 * Inspects and cryptographically verifies embedded digital signatures in a PDF byte buffer.
 */
export async function checkPdfSignaturesBytes(pdfBytes: Uint8Array): Promise<{
  text: string;
  signatures: PdfSignatureReport[];
}> {
  if (pdfBytes.length > MAX_BYTES) throw new ToolInputError('PDF file is too large (maximum 64 MB).');
  const latin1 = new TextDecoder('latin1').decode(pdfBytes);
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const matches = [...latin1.matchAll(byteRangeRegex)];
  if (matches.length === 0) {
    throw new ToolInputError('No digital signature (/ByteRange) was found in this PDF.');
  }

  const signatures: PdfSignatureReport[] = [];
  for (const [idx, m] of matches.entries()) {
    const pos = m.index ?? 0;
    const windowStart = Math.max(0, pos - 2048);
    const windowEnd = Math.min(latin1.length, pos + 65536);
    const dictText = latin1.slice(windowStart, windowEnd);

    const byteRange: [number, number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const subFilter = /\/SubFilter\s*\/([A-Za-z0-9._-]+)/.exec(dictText)?.[1] ?? 'adbe.pkcs7.detached';
    const signerName = /\/Name\s*\(((?:\\.|[^\\)])*)\)/.exec(dictText)?.[1];
    const reason = /\/Reason\s*\(((?:\\.|[^\\)])*)\)/.exec(dictText)?.[1];
    const location = /\/Location\s*\(((?:\\.|[^\\)])*)\)/.exec(dictText)?.[1];

    // Check whether ByteRange covers [0, startOfContents] and [endOfContents, pdfBytes.length].
    const gap = byteRange[2] - (byteRange[0] + byteRange[1]);
    const coversWholeDocument = byteRange[0] === 0 && gap > 2 && byteRange[2] + byteRange[3] === pdfBytes.length;

    // Extract /Contents <hex> either from the ByteRange gap or from dictText.
    let contentsHex = '';
    if (byteRange[1] > 0 && byteRange[2] > byteRange[0] + byteRange[1] && byteRange[2] <= pdfBytes.length) {
      const gapText = latin1.slice(byteRange[0] + byteRange[1], byteRange[2]).trim();
      if (gapText.startsWith('<') && gapText.endsWith('>')) {
        contentsHex = gapText.slice(1, -1).replace(/\s+/g, '');
      }
    }
    if (!contentsHex) {
      contentsHex = /\/Contents\s*<([0-9A-Fa-f\s]+)>/.exec(dictText)?.[1]?.replace(/\s+/g, '') ?? '';
    }

    let cms: ParsedCms | undefined;
    let verifyResult: { byteRangeDigestMatch?: boolean; signatureValid?: boolean; note?: string } = {};
    if (contentsHex.length >= 4 && contentsHex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(contentsHex)) {
      const rawCms = trimTrailingZeroBytes(hex.decode(contentsHex));
      if (rawCms.length > 0 && rawCms[0] === 0x30) {
        cms = parseCmsSignedData(rawCms);
        verifyResult = await verifySignatureCrypto(pdfBytes, byteRange, cms);
      }
    }

    let status = 'dictionary parsed (no CMS payload)';
    if (cms) {
      if (verifyResult.signatureValid === true && verifyResult.byteRangeDigestMatch !== false) {
        status = coversWholeDocument ? 'valid signature' : 'valid signature (unsigned bytes follow ByteRange)';
      } else if (verifyResult.signatureValid === false || verifyResult.byteRangeDigestMatch === false) {
        status = 'invalid signature (digest or cryptographic verification failed)';
      } else {
        status = verifyResult.note ?? 'CMS certificate parsed';
      }
    }

    signatures.push({
      index: idx + 1,
      subFilter,
      ...(signerName ? { signerName: decodePdfLiteral(signerName) } : {}),
      ...(reason ? { reason: decodePdfLiteral(reason) } : {}),
      ...(location ? { location: decodePdfLiteral(location) } : {}),
      ...(cms?.signingTime ? { signingTime: cms.signingTime } : {}),
      byteRange,
      coversWholeDocument,
      ...(cms?.cert
        ? {
            subject: cms.cert.subject,
            issuer: cms.cert.issuer,
            serial: cms.cert.serial,
            notBefore: cms.cert.notBefore,
            notAfter: cms.cert.notAfter,
          }
        : {}),
      ...(cms?.digestAlg ? { digestAlgorithm: cms.digestAlg } : {}),
      ...(cms?.signatureAlgorithm ? { signatureAlgorithm: cms.signatureAlgorithm } : {}),
      ...(verifyResult.byteRangeDigestMatch !== undefined
        ? { byteRangeDigestMatch: verifyResult.byteRangeDigestMatch }
        : {}),
      ...(verifyResult.signatureValid !== undefined ? { signatureValid: verifyResult.signatureValid } : {}),
      status,
    });
  }

  return {
    text: signatures.map(formatReport).join('\n\n'),
    signatures,
  };
}

/**
 * Accepts a PDF signature dictionary snippet, a Base64-encoded PDF, or raw PDF text.
 */
export async function pdfSignature(input: string): Promise<string> {
  if (input.length > MAX_TEXT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';

  if (trimmed.startsWith('JVBERi0')) {
    try {
      const bytes = base64.decode(trimmed.replace(/\s+/g, ''));
      return (await checkPdfSignaturesBytes(bytes)).text;
    } catch (error) {
      if (error instanceof ToolInputError) throw error;
      throw new ToolInputError('Invalid Base64 PDF data.');
    }
  }

  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
  return (await checkPdfSignaturesBytes(bytes)).text;
}

function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  if (raw.length === 64) {
    return derSeq([derInteger(raw.subarray(0, 32)), derInteger(raw.subarray(32, 64))]);
  }
  return raw;
}

function encodeUtcTime(date: Date): Uint8Array {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(date.getUTCFullYear() % 100);
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return derTag(0x17, new TextEncoder().encode(`${yy}${mm}${dd}${hh}${mi}${ss}Z`));
}

function encodeRdnName(cn: string, org: string): Uint8Array {
  const cnAtv = derSeq([derOid('2.5.4.3'), derTag(0x0c, new TextEncoder().encode(cn))]);
  const orgAtv = derSeq([derOid('2.5.4.10'), derTag(0x0c, new TextEncoder().encode(org))]);
  return derSeq([derTag(0x31, cnAtv), derTag(0x31, orgAtv)]);
}

/**
 * Generates a genuine, standards-compliant signed PDF in the browser using WebCrypto
 * (ECDSA P-256 + SHA-256 + X.509 certificate + CMS SignedData in /ByteRange + /Contents).
 */
export async function createSignedTestPdf(
  commonName = 'Alice Example',
  reason = 'Document approved',
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new ToolInputError('Generating a signed PDF needs WebCrypto (HTTPS or localhost).');

  const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));
  const spkiNode = parseDer(spki);
  const pubKeyBits = bitStringPayload(spkiNode.children[1]!);

  const nameDer = encodeRdnName(commonName, 'xt-tools');
  const now = new Date('2026-11-06T12:00:00Z');
  const later = new Date('2027-11-06T12:00:00Z');
  const tbsCert = derSeq([
    derTag(0xa0, derInteger(new Uint8Array([2]))),
    derInteger(new Uint8Array([0x01, 0x23, 0x45, 0x67])),
    derSeq([derOid('1.2.840.10045.4.3.2')]),
    nameDer,
    derSeq([encodeUtcTime(now), encodeUtcTime(later)]),
    nameDer,
    spki,
  ]);
  const certSigRaw = new Uint8Array(
    await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, copyBytes(tbsCert)),
  );
  const certDer = derSeq([tbsCert, derSeq([derOid('1.2.840.10045.4.3.2')]), derBitString(ecdsaRawToDer(certSigRaw))]);

  const hexSlotLen = 2048;
  const prefix = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>\nendobj\n4 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (${commonName}) /Reason (${reason}) `;
  const suffix = `\n>>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;

  // Reserve a fixed-width /ByteRange line so the offsets stay exact once filled in.
  const brTemplate = (o1: number, l1: number, o2: number, l2: number) =>
    `/ByteRange [${String(o1).padStart(6, '0')} ${String(l1).padStart(6, '0')} ${String(o2).padStart(6, '0')} ${String(l2).padStart(6, '0')}] /Contents `;

  const sampleBr = brTemplate(0, 0, 0, 0);
  const o1 = 0;
  const l1 = prefix.length + sampleBr.length;
  const o2 = l1 + 1 + hexSlotLen + 1;
  const l2 = suffix.length;
  const finalBr = brTemplate(o1, l1, o2, l2);

  const enc = new TextEncoder();
  const part1 = enc.encode(prefix + finalBr);
  const part2 = enc.encode(suffix);
  const signedRange = concatBytes([part1, part2]);
  const rangeDigest = new Uint8Array(await subtle.digest('SHA-256', copyBytes(signedRange)));

  // Build CMS SignedData signedAttrs: contentType (data), signingTime, messageDigest
  const attrContentType = derSeq([derOid('1.2.840.113549.1.9.3'), derTag(0x31, derOid('1.2.840.113549.1.7.1'))]);
  const attrSigningTime = derSeq([derOid('1.2.840.113549.1.9.5'), derTag(0x31, encodeUtcTime(now))]);
  const attrMessageDigest = derSeq([derOid('1.2.840.113549.1.9.4'), derTag(0x31, derTag(0x04, rangeDigest))]);
  const attrsBody = concatBytes([attrContentType, attrSigningTime, attrMessageDigest]);
  const signedAttrsSet = derTag(0x31, attrsBody);
  const signedAttrsImplicit = derTag(0xa0, attrsBody);

  const cmsSigRaw = new Uint8Array(
    await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, copyBytes(signedAttrsSet)),
  );
  const cmsSigDer = ecdsaRawToDer(cmsSigRaw);

  const issuerAndSerial = derSeq([nameDer, derInteger(new Uint8Array([0x01, 0x23, 0x45, 0x67]))]);
  const signerInfo = derSeq([
    derInteger(new Uint8Array([1])),
    issuerAndSerial,
    derSeq([derOid('2.16.840.1.101.3.4.2.1')]),
    signedAttrsImplicit,
    derSeq([derOid('1.2.840.10045.4.3.2')]),
    derTag(0x04, cmsSigDer),
  ]);

  void pubKeyBits;
  const signedData = derSeq([
    derInteger(new Uint8Array([1])),
    derTag(0x31, derSeq([derOid('2.16.840.1.101.3.4.2.1')])),
    derSeq([derOid('1.2.840.113549.1.7.1')]),
    derTag(0xa0, certDer),
    derTag(0x31, signerInfo),
  ]);
  const contentInfo = derSeq([derOid('1.2.840.113549.1.7.2'), derTag(0xa0, signedData)]);
  const cmsHex = hex.encode(contentInfo).padEnd(hexSlotLen, '0');
  if (cmsHex.length > hexSlotLen) throw new ToolInputError('CMS payload exceeded reserved PDF /Contents slot.');

  return concatBytes([part1, enc.encode(`<${cmsHex}>`), part2]);
}
