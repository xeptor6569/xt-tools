import { describe, expect, it } from 'vitest';
import { formatKey } from './logic.ts';

describe('formatKey', () => {
  it('prints key, code, keyCode, location and modifiers', () => {
    expect(
      formatKey({
        key: 'A',
        code: 'KeyA',
        keyCode: 65,
        location: 0,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe('key: A\ncode: KeyA\nkeyCode: 65\nlocation: standard\nmodifiers: Ctrl+Shift');
  });

  it('names the numpad and an empty modifier set', () => {
    expect(
      formatKey({
        key: '1',
        code: 'Numpad1',
        keyCode: 97,
        location: 3,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toContain('location: numpad');
    expect(
      formatKey({
        key: '1',
        code: 'Numpad1',
        keyCode: 97,
        location: 3,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }),
    ).toContain('modifiers: (none)');
  });
});
