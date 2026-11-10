import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { checkPdfSignaturesBytes, createSignedTestPdf, pdfSignature } from './logic.ts';

describe('pdfSignature', () => {
  it('parses a PDF signature dictionary snippet', async () => {
    const snippet =
      '%PDF-1.7\n1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (Alice Example) /Reason (Release sign-off) /ByteRange [0 120 200 40] /Contents <0000> >>\nendobj';
    const report = await pdfSignature(snippet);
    expect(report).toContain('subFilter: adbe.pkcs7.detached');
    expect(report).toContain('name: Alice Example');
    expect(report).toContain('reason: Release sign-off');
    expect(report).toContain('byteRange: [0, 120, 200, 40]');
  });

  it('verifies a genuine WebCrypto-signed PDF and detects tampering', async () => {
    const signedPdf = await createSignedTestPdf('Alice Signer', 'Quarterly audit');
    const verified = await checkPdfSignaturesBytes(signedPdf);
    expect(verified.signatures).toHaveLength(1);
    const sig = verified.signatures[0]!;
    expect(sig.coversWholeDocument).toBe(true);
    expect(sig.byteRangeDigestMatch).toBe(true);
    expect(sig.signatureValid).toBe(true);
    expect(sig.subject).toContain('CN=Alice Signer');
    expect(verified.text).toContain('status: valid signature');
    expect(verified.text).toContain('cryptoVerify: valid');

    // Tamper with a byte inside the first signed range.
    const tampered = new Uint8Array(signedPdf);
    tampered[10] = tampered[10] === 0x37 ? 0x36 : 0x37;
    const afterTamper = await checkPdfSignaturesBytes(tampered);
    expect(afterTamper.signatures[0]!.byteRangeDigestMatch).toBe(false);
    expect(afterTamper.text).toContain('status: invalid signature');
  });

  it('flags incremental data appended after ByteRange', async () => {
    const signedPdf = await createSignedTestPdf('Bob Signer', 'Initial sign');
    const extended = new Uint8Array(signedPdf.length + 16);
    extended.set(signedPdf, 0);
    extended.set(new TextEncoder().encode('\n% extra comment'), signedPdf.length);
    const result = await checkPdfSignaturesBytes(extended);
    expect(result.signatures[0]!.coversWholeDocument).toBe(false);
    expect(result.signatures[0]!.signatureValid).toBe(true);
    expect(result.text).toContain('partial (bytes exist outside ByteRange)');
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => pdfSignature(input), { timeLimitMs: 5000 });
  });
});
