// Capabilities a tool can require. Each has a label, an explanation shown when
// it is missing, and a browser check. Checks only touch browser globals when
// called, so this module can be imported from Node scripts.

export interface CapabilityInfo {
  id: string;
  label: string;
  /** Shown when the check fails. */
  missing: string;
  /** Whether the capability is only available in a secure context. */
  secure: boolean;
  check: () => boolean;
}

const hasSecureContext = () => typeof globalThis.isSecureContext === 'boolean' && globalThis.isSecureContext;
const nav = () => (typeof navigator === 'undefined' ? undefined : navigator);

export const capabilities = [
  {
    id: 'secure-context',
    label: 'Secure context',
    missing: 'This tool needs the site to be opened over HTTPS or on localhost.',
    secure: true,
    check: hasSecureContext,
  },
  {
    id: 'webcrypto',
    label: 'WebCrypto',
    missing: 'This tool uses the browser’s WebCrypto API, which needs HTTPS or localhost.',
    secure: true,
    check: () => hasSecureContext() && typeof globalThis.crypto?.subtle !== 'undefined',
  },
  {
    id: 'clipboard-read',
    label: 'Clipboard read',
    missing: 'Reading the clipboard needs HTTPS or localhost. You can still paste with Ctrl+V or ⌘V.',
    secure: true,
    check: () => hasSecureContext() && typeof nav()?.clipboard?.readText === 'function',
  },
  {
    id: 'camera',
    label: 'Camera',
    missing: 'Camera access needs HTTPS or localhost and a browser that supports it.',
    secure: true,
    check: () => hasSecureContext() && typeof nav()?.mediaDevices?.getUserMedia === 'function',
  },
  {
    id: 'microphone',
    label: 'Microphone',
    missing: 'Microphone access needs HTTPS or localhost and a browser that supports it.',
    secure: true,
    check: () => hasSecureContext() && typeof nav()?.mediaDevices?.getUserMedia === 'function',
  },
  {
    id: 'display-capture',
    label: 'Screen capture',
    missing: 'Screen capture needs HTTPS or localhost and a desktop browser that supports it.',
    secure: true,
    check: () => hasSecureContext() && typeof nav()?.mediaDevices?.getDisplayMedia === 'function',
  },
  {
    id: 'local-fonts',
    label: 'Local fonts',
    missing:
      'Listing installed fonts needs HTTPS or localhost and a Chromium-based browser. A built-in list is used instead.',
    secure: true,
    check: () => hasSecureContext() && 'queryLocalFonts' in globalThis,
  },
  {
    id: 'speech-synthesis',
    label: 'Speech synthesis',
    missing: 'This browser does not support speech synthesis.',
    secure: false,
    check: () => 'speechSynthesis' in globalThis,
  },
  {
    id: 'service-worker',
    label: 'Service worker',
    missing: 'Offline mode needs HTTPS or localhost.',
    secure: true,
    check: () => hasSecureContext() && nav() !== undefined && 'serviceWorker' in navigator,
  },
] as const satisfies readonly CapabilityInfo[];

export type Capability = (typeof capabilities)[number]['id'];

export const capabilityIds: readonly string[] = capabilities.map((c) => c.id);

export function missingCapabilities(required: readonly string[]): CapabilityInfo[] {
  return capabilities.filter((c) => required.includes(c.id) && !c.check());
}
