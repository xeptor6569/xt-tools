import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import meta from './meta.ts';
import { wifiQr } from './logic.ts';

describe('wifiQr', () => {
  it('builds a WPA payload from "SSID password"', () => {
    expect(wifiQr('MyNet password')).toBe('WIFI:T:WPA;S:MyNet;P:password;;');
  });

  it('keeps spaces in the password and accepts an auth prefix', () => {
    expect(wifiQr('WPA MyNet hello world')).toBe('WIFI:T:WPA;S:MyNet;P:hello world;;');
    expect(wifiQr('WEP Cafe secret')).toBe('WIFI:T:WEP;S:Cafe;P:secret;;');
    expect(wifiQr('nopass Guest')).toBe('WIFI:T:nopass;S:Guest;;');
  });

  it('uses a pipe when the network name contains spaces', () => {
    expect(wifiQr('My Net|secret')).toBe('WIFI:T:WPA;S:My Net;P:secret;;');
    expect(wifiQr('WPA|My Net|secret')).toBe('WIFI:T:WPA;S:My Net;P:secret;;');
  });

  it('escapes backslash, semicolon, comma, colon and quote', () => {
    expect(wifiQr(String.raw`a\b c;d,e:f"g`)).toBe(String.raw`WIFI:T:WPA;S:a\\b;P:c\;d\,e\:f\"g;;`);
  });

  it('treats a bare name as an open network', () => {
    expect(wifiQr('hello')).toBe('WIFI:T:nopass;S:hello;;');
  });

  it('rejects a protected network with no password and an overlong name', () => {
    expect(() => wifiQr('WPA OnlyNet')).toThrow(ToolInputError);
    expect(() => wifiQr(`WPA ${'n'.repeat(33)} secret`)).toThrow(/32 bytes/);
    expect(wifiQr('')).toBe('');
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(wifiQr(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(wifiQr);
  });
});
