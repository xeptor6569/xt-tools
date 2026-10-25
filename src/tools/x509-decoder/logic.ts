import { ToolInputError } from '../types.ts';
import {
  algorithmName,
  decodePem,
  formatName,
  formatTime,
  integerHex,
  parseDer,
  subjectAltNames,
  type DerNode,
} from './der.ts';

const MAX_INPUT = 1_000_000;

function tbsFields(tbs: DerNode): {
  serial: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  subject: string;
  san: string;
} {
  const kids = tbs.children;
  let i = 0;
  if (kids[0]?.cls === 2 && kids[0].tag === 0) i++;
  const serialNode = kids[i++];
  i++; // signature algorithm inside the TBS
  const issuer = kids[i++];
  const validity = kids[i++];
  const subject = kids[i++];
  i++; // subject public key
  if (!serialNode || !issuer || !validity || !subject || validity.children.length < 2) {
    throw new ToolInputError('Certificate is missing a required field.');
  }
  let san = '';
  for (const extra of kids.slice(i)) {
    if (extra.cls === 2 && extra.tag === 3) san = subjectAltNames(extra);
  }
  return {
    serial: integerHex(serialNode),
    issuer: formatName(issuer),
    notBefore: formatTime(validity.children[0]!),
    notAfter: formatTime(validity.children[1]!),
    subject: formatName(subject),
    san,
  };
}

/** Decodes a PEM X.509 certificate into subject, issuer, validity, serial, signature algorithm and SAN. */
export function x509Decoder(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { label, der } = decodePem(input);
  if (!/CERTIFICATE/.test(label)) throw new ToolInputError('Paste a PEM certificate.');
  const cert = parseDer(der);
  if (cert.tag !== 16 || cert.children.length < 3) throw new ToolInputError('That is not an X.509 certificate.');
  const tbs = cert.children[0]!;
  const fields = tbsFields(tbs);
  const lines = [
    `subject: ${fields.subject}`,
    `issuer: ${fields.issuer}`,
    `serial: ${fields.serial}`,
    `notBefore: ${fields.notBefore}`,
    `notAfter: ${fields.notAfter}`,
    `signatureAlgorithm: ${algorithmName(cert.children[1]!)}`,
  ];
  if (fields.san) lines.push(`san: ${fields.san}`);
  return lines.join('\n');
}
