import { describe, expect, it } from 'vitest';
import { formatDeviceInfo, type DeviceSnapshot } from './logic.ts';

const sample: DeviceSnapshot = {
  userAgent: 'TestAgent',
  language: 'en-GB',
  languages: 'en-GB, en',
  platform: 'TestPlatform',
  vendor: 'TestVendor',
  cookieEnabled: 'true',
  hardwareConcurrency: '8',
  maxTouchPoints: '0',
  screen: '1920 × 1080',
  availableScreen: '1920 × 1040',
  colorDepth: '24',
  pixelRatio: '2',
  viewport: '1280 × 720',
  timezone: 'UTC',
};

describe('formatDeviceInfo', () => {
  it('lists local fields and nothing about the network', () => {
    const rows = formatDeviceInfo(sample);
    expect(rows.map((row) => row.label)).toEqual([
      'User agent',
      'Language',
      'Languages',
      'Platform',
      'Vendor',
      'Cookies enabled',
      'CPU cores',
      'Touch points',
      'Screen',
      'Available screen',
      'Color depth',
      'Pixel ratio',
      'Viewport',
      'Time zone',
    ]);
    expect(rows.find((row) => row.label === 'User agent')?.value).toBe('TestAgent');
    expect(rows.find((row) => row.label === 'Time zone')?.value).toBe('UTC');
    const blob = rows
      .map((row) => `${row.label} ${row.value}`)
      .join('\n')
      .toLowerCase();
    expect(blob).not.toContain('ip address');
    expect(blob).not.toContain('lookup');
  });
});
