import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { hostsMerger } from './logic.ts';

describe('hostsMerger', () => {
  it('merges hosts lines and adblock rules, dropping comments and duplicates', () => {
    const input = [
      '# comment',
      '',
      '127.0.0.1 localhost',
      '||ads.example^',
      '0.0.0.0 ads.example',
      '0.0.0.0 doubleclick.net',
      '::1 localhost',
      '! banner',
      '@@||good.example^',
      '127.0.0.1 LocalHost extra.example # note',
    ].join('\n');
    expect(hostsMerger(input)).toBe(
      [
        '0.0.0.0 ads.example',
        '0.0.0.0 doubleclick.net',
        '127.0.0.1 extra.example',
        '127.0.0.1 localhost',
        '::1 localhost',
      ].join('\n'),
    );
  });

  it('keeps distinct addresses for one name and canonicalises IPv6', () => {
    expect(hostsMerger('0:0:0:0:0:0:0:1 ip6-localhost\n||Ads.Example^$third-party')).toBe(
      '0.0.0.0 ads.example\n::1 ip6-localhost',
    );
  });

  it('treats a bare domain as a block and skips junk', () => {
    expect(hostsMerger('example.com\n##.banner\n||*.wild^')).toBe('0.0.0.0 example.com');
    expect(hostsMerger('')).toBe('');
    expect(hostsMerger('# nothing\n\n! still nothing')).toBe('');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(hostsMerger, { malformed: ['||^', 'not a host!!!', '256.1.1.1 example.com'] });
  });
});
