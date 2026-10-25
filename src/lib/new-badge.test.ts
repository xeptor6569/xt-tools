import { describe, expect, it } from 'vitest';
import { isNew } from './new-badge.ts';

describe('isNew', () => {
  const today = '2026-10-24';

  it('includes the build date and the day 30 days earlier', () => {
    expect(isNew({ added: '2026-10-24' }, today)).toBe(true);
    expect(isNew({ added: '2026-09-24' }, today)).toBe(true);
  });

  it('excludes older tools and dates after the build', () => {
    expect(isNew({ added: '2026-09-23' }, today)).toBe(false);
    expect(isNew({ added: '2026-10-25' }, today)).toBe(false);
  });

  it('ignores unparseable dates', () => {
    expect(isNew({ added: 'yesterday' }, today)).toBe(false);
    expect(isNew({ added: '2026-10-24' }, 'soon')).toBe(false);
  });
});
