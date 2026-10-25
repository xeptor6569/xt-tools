import { useEffect, useState } from 'preact/hooks';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { formatDeviceInfo, type DeviceRow, type DeviceSnapshot } from './logic.ts';

function readSnapshot(): DeviceSnapshot {
  const nav = navigator;
  const screenInfo = window.screen;
  return {
    userAgent: nav.userAgent,
    language: nav.language,
    languages: nav.languages.join(', '),
    platform: nav.platform,
    vendor: nav.vendor,
    cookieEnabled: nav.cookieEnabled ? 'yes' : 'no',
    hardwareConcurrency: String(nav.hardwareConcurrency ?? ''),
    maxTouchPoints: String(nav.maxTouchPoints ?? ''),
    screen: `${screenInfo.width} × ${screenInfo.height}`,
    availableScreen: `${screenInfo.availWidth} × ${screenInfo.availHeight}`,
    colorDepth: String(screenInfo.colorDepth),
    pixelRatio: String(window.devicePixelRatio),
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  };
}

export default function DeviceInfoTool() {
  const [rows, setRows] = useState<DeviceRow[]>([]);

  useEffect(() => {
    setRows(formatDeviceInfo(readSnapshot()));
  }, []);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Values this page can already see. Nothing here is an IP address, and nothing is sent anywhere.
      </p>
      <OutputRegion label="This browser">{rows.length > 0 && <KeyValueList items={rows} />}</OutputRegion>
    </div>
  );
}
