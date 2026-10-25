import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipInRange } from './logic.ts';

describe('ipInRange', () => {
  it('answers yes or no for CIDRs and inclusive ranges', () => {
    const text = ipInRange(
      '192.168.1.50\n192.168.1.0/24\n10.0.0.0/8\n192.168.1.0-192.168.1.40\n192.168.1.40 - 192.168.1.60',
    );
    expect(text).toBe(
      [
        '192.168.1.0/24: yes',
        '10.0.0.0/8: no',
        '192.168.1.0-192.168.1.40: no',
        '192.168.1.40 - 192.168.1.60: yes',
      ].join('\n'),
    );
  });

  it('uses the prefix, not the host bits written in the CIDR', () => {
    expect(ipInRange('10.1.2.3\n10.9.9.9/8')).toBe('10.9.9.9/8: yes');
  });

  it('checks IPv6 prefixes and ranges', () => {
    const text = ipInRange('2001:db8::1\n2001:db8::/32\n2001:db8::2-2001:db8::10');
    expect(text).toBe('2001:db8::/32: yes\n2001:db8::2-2001:db8::10: no');
  });

  it('rejects a missing range, mixed families and inverted spans', () => {
    expect(ipInRange('')).toBe('');
    expect(() => ipInRange('192.168.1.1')).toThrow(ToolInputError);
    expect(() => ipInRange('192.168.1.1\n2001:db8::/32')).toThrow(ToolInputError);
    expect(() => ipInRange('10.0.0.2\n10.0.0.5-10.0.0.1')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ipInRange, { malformed: ['1.2.3.4\nnot-a-range', '1.2.3.4\n10.0.0.0/', '::1\n::2-::1'] });
  });
});
