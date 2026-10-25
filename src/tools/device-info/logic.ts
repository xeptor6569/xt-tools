export interface DeviceSnapshot {
  userAgent: string;
  language: string;
  languages: string;
  platform: string;
  vendor: string;
  cookieEnabled: string;
  hardwareConcurrency: string;
  maxTouchPoints: string;
  screen: string;
  availableScreen: string;
  colorDepth: string;
  pixelRatio: string;
  viewport: string;
  timezone: string;
}

export interface DeviceRow {
  label: string;
  value: string;
}

/** Format a snapshot of local navigator and screen values. No address and no network. */
export function formatDeviceInfo(info: DeviceSnapshot): DeviceRow[] {
  return [
    { label: 'User agent', value: info.userAgent },
    { label: 'Language', value: info.language },
    { label: 'Languages', value: info.languages },
    { label: 'Platform', value: info.platform },
    { label: 'Vendor', value: info.vendor },
    { label: 'Cookies enabled', value: info.cookieEnabled },
    { label: 'CPU cores', value: info.hardwareConcurrency },
    { label: 'Touch points', value: info.maxTouchPoints },
    { label: 'Screen', value: info.screen },
    { label: 'Available screen', value: info.availableScreen },
    { label: 'Color depth', value: info.colorDepth },
    { label: 'Pixel ratio', value: info.pixelRatio },
    { label: 'Viewport', value: info.viewport },
    { label: 'Time zone', value: info.timezone },
  ];
}
