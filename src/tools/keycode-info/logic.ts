export interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
  location: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const LOCATIONS = ['standard', 'left', 'right', 'numpad'] as const;

/** Describe one keydown. This does not look at the network. */
export function formatKey(info: KeyInfo): string {
  const modifiers = [
    info.ctrlKey ? 'Ctrl' : '',
    info.altKey ? 'Alt' : '',
    info.shiftKey ? 'Shift' : '',
    info.metaKey ? 'Meta' : '',
  ].filter(Boolean);
  const location = LOCATIONS[info.location] ?? String(info.location);
  return [
    `key: ${info.key}`,
    `code: ${info.code}`,
    `keyCode: ${info.keyCode}`,
    `location: ${location}`,
    `modifiers: ${modifiers.join('+') || '(none)'}`,
  ].join('\n');
}
