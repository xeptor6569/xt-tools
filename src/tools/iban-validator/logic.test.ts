import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { groupIban, ibanMod97, ibanValidator, isQrIban } from './logic.ts';

/** ISO 13616 check digits for a country and BBAN, so the tests do not hard-code a checksum. */
function withCheck(country: string, bban: string): string {
  const check = 98 - ibanMod97(`${country}00${bban}`);
  return `${country}${String(check).padStart(2, '0')}${bban}`;
}
import meta from './meta.ts';

describe('ibanValidator', () => {
  it('accepts the well-known GB and DE examples', () => {
    expect(ibanMod97('GB82WEST12345698765432')).toBe(1);
    expect(ibanMod97('DE89370400440532013000')).toBe(1);
    expect(ibanMod97('FR1420041010050500013M02606')).toBe(1);
    const output = ibanValidator('gb82 west 1234 5698 7654 32');
    expect(output).toContain('Valid IBAN');
    expect(output).toContain('GB82 WEST 1234 5698 7654 32');
    expect(output).toContain('United Kingdom');
    expect(output).toContain('BBAN: WEST12345698765432');
    expect(output).toContain('QR-IBAN: no');
    expect(groupIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('labels the BBAN and Swiss QR-IBAN status', () => {
    const qrCh = withCheck('CH', '31999000000000000');
    const normalCh = withCheck('CH', '00762000000000000');
    const below = withCheck('CH', '29999000000000000');
    const above = withCheck('CH', '32000000000000000');
    const qrLi = withCheck('LI', '30000000000000000');
    expect(ibanMod97(qrCh)).toBe(1);
    expect(isQrIban(qrCh)).toBe(true);
    expect(isQrIban(normalCh)).toBe(false);
    expect(isQrIban(below)).toBe(false);
    expect(isQrIban(above)).toBe(false);
    expect(isQrIban(qrLi)).toBe(true);
    expect(isQrIban('GB82WEST12345698765432')).toBe(false);
    const qr = ibanValidator(qrCh);
    expect(qr).toContain('BBAN: 31999000000000000');
    expect(qr).toContain('Switzerland');
    expect(qr).toContain('QR-IBAN: yes');
    expect(ibanValidator(normalCh)).toContain('QR-IBAN: no');
    expect(ibanValidator(qrLi)).toContain('QR-IBAN: yes');
    expect(ibanValidator(below)).toContain('QR-IBAN: no');
    expect(ibanValidator(above)).toContain('QR-IBAN: no');
  });

  it('rejects a bad MOD-97 checksum', () => {
    expect(ibanMod97('GB82WEST12345698765433')).not.toBe(1);
    expect(() => ibanValidator('GB82WEST12345698765433')).toThrow(ToolInputError);
    expect(() => ibanValidator('GB82WEST12345698765433')).toThrow(/MOD-97/);
  });

  it('rejects the wrong length for a known country', () => {
    expect(() => ibanValidator('GB82WEST1234569876543')).toThrow(/22 characters/);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(ibanValidator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ibanValidator, { malformed: ['GB00', '!!', 'DE00'] });
  });
});
