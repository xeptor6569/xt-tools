import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ipv4RangeExpander } from './logic.ts';

describe('ipv4RangeExpander', () => {
  it('covers a /24 written with a space or a dash', () => {
    expect(ipv4RangeExpander('192.168.1.0 192.168.1.255')).toBe('192.168.1.0/24');
    expect(ipv4RangeExpander('192.168.1.0-192.168.1.255')).toBe('192.168.1.0/24');
    expect(ipv4RangeExpander('192.168.1.0 - 192.168.1.255')).toBe('192.168.1.0/24');
  });

  it('joins an aligned pair into a supernet and splits an unaligned range', () => {
    expect(ipv4RangeExpander('10.0.0.0-10.0.1.255')).toBe('10.0.0.0/23');
    expect(ipv4RangeExpander('192.168.1.0 192.168.2.255')).toBe('192.168.1.0/24\n192.168.2.0/24');
    expect(ipv4RangeExpander('10.0.0.1 10.0.0.255')).toBe(
      [
        '10.0.0.1/32',
        '10.0.0.2/31',
        '10.0.0.4/30',
        '10.0.0.8/29',
        '10.0.0.16/28',
        '10.0.0.32/27',
        '10.0.0.64/26',
        '10.0.0.128/25',
      ].join('\n'),
    );
  });

  it('covers one host and the whole address space', () => {
    expect(ipv4RangeExpander('8.8.8.8 8.8.8.8')).toBe('8.8.8.8/32');
    expect(ipv4RangeExpander('0.0.0.0 255.255.255.255')).toBe('0.0.0.0/0');
  });

  it('rejects an inverted range and garbage', () => {
    expect(ipv4RangeExpander('')).toBe('');
    expect(() => ipv4RangeExpander('192.168.1.255 192.168.1.0')).toThrow(ToolInputError);
    expect(() => ipv4RangeExpander('10.0.0.0')).toThrow(ToolInputError);
    expect(() => ipv4RangeExpander('hello world')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ipv4RangeExpander, { malformed: ['10.0.0.0-', '-10.0.0.1', '010.0.0.1 10.0.0.2'] });
  });
});
