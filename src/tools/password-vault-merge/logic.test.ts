import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { siteHost } from './logic.ts';
import { mergeVaultSources, passwordVaultMerge } from './logic.ts';
import meta from './meta.ts';

const BITWARDEN = [
  'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
  'Work,1,login,Example,Bitwarden note,,0,https://www.example.com/login,Alice,correct-horse,',
].join('\n');

const APPLE = [
  'Title,URL,Username,Password,Notes,OTPAuth',
  'Example,https://example.com/login,alice,correct-horse,Apple note,GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
].join('\n');

const CHROME_CONFLICT = ['name,url,username,password', 'Example,https://example.com/settings,alice,chrome-secret'].join(
  '\n',
);

const CHROME_ONLY = ['name,url,username,password', 'Other,https://other.example/path,bob,other-secret'].join('\n');

describe('password vault merge', () => {
  it('treats www and a path as the same site', () => {
    expect(siteHost('https://www.Example.com/login')).toBe('example.com');
    expect(siteHost('accounts.google.com')).toBe('accounts.google.com');
    expect(siteHost('')).toBe('');
  });

  it('folds a shared password and keeps an Apple TOTP', async () => {
    const report = await mergeVaultSources([
      { name: 'bitwarden.csv', text: BITWARDEN },
      { name: 'apple.csv', text: APPLE },
    ]);
    expect(report.folded).toBe(1);
    expect(report.added).toBe(0);
    expect(report.conflicts).toHaveLength(0);
    expect(report.logins).toBe(1);
    expect(report.summary).toContain('folded: 1');
    const json = JSON.parse(report.bitwardenJson) as { items: Array<Record<string, unknown>> };
    expect(json.items).toHaveLength(1);
    const login = json.items[0]?.login as { password: string; totp: string; uris: Array<{ uri: string }> };
    expect(login.password).toBe('correct-horse');
    expect(login.totp).toContain('GEZDGNBVGY3TQOJQ');
    expect(login.uris.map((uri) => uri.uri)).toEqual(['https://www.example.com/login']);
    expect(String(json.items[0]?.notes)).toContain('[from Apple Passwords]');
    expect(String(json.items[0]?.notes)).toContain('Apple note');
    expect(json.items[0]?.folderId).toBe('folder-1');
  });

  it('keeps the Bitwarden password when a straggler disagrees, and can switch', async () => {
    const sources = [
      { name: 'bitwarden.csv', text: BITWARDEN },
      { name: 'chrome.csv', text: CHROME_CONFLICT },
    ];
    const report = await mergeVaultSources(sources);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]?.defaultPassword).toBe('correct-horse');
    expect(report.conflicts[0]?.options.map((option) => option.sourceLabel)).toEqual(['Bitwarden', 'Chrome']);
    expect(report.folded).toBe(0);
    expect(JSON.parse(report.bitwardenJson).items[0].login.password).toBe('correct-horse');

    const chrome = report.conflicts[0]!.options[1]!.password;
    const chosen = await mergeVaultSources(sources, { [report.conflicts[0]!.id]: chrome });
    expect(JSON.parse(chosen.bitwardenJson).items[0].login.password).toBe('chrome-secret');
  });

  it('puts a Chrome-only login in Imported from Chrome', async () => {
    const report = await mergeVaultSources([
      { name: 'bitwarden.csv', text: BITWARDEN },
      { name: 'chrome.csv', text: CHROME_ONLY },
    ]);
    expect(report.added).toBe(1);
    expect(report.folded).toBe(0);
    const json = JSON.parse(report.bitwardenJson) as {
      folders: Array<{ id: string; name: string }>;
      items: Array<{ name: string; folderId: string }>;
    };
    const other = json.items.find((item) => item.name === 'Other');
    const folder = json.folders.find((item) => item.id === other?.folderId);
    expect(folder?.name).toBe('Imported from Chrome');
  });

  it('copies a Bitwarden card through to the JSON download only', async () => {
    const bitwarden = JSON.stringify({
      encrypted: false,
      folders: [{ id: 'f1', name: 'Finance' }],
      items: [
        { id: 'card-1', type: 3, name: 'Visa', folderId: 'f1', card: { number: '4111111111111111' } },
        {
          id: 'login-1',
          type: 1,
          name: 'Example',
          login: { username: 'alice', password: 'correct-horse', uris: [{ uri: 'https://example.com' }] },
        },
      ],
    });
    const report = await mergeVaultSources([
      { name: 'bitwarden.json', text: bitwarden },
      { name: 'chrome.csv', text: CHROME_ONLY },
    ]);
    expect(report.passthrough).toBe(1);
    expect(report.summary).toContain('passthrough items are included in the JSON download only');
    const json = JSON.parse(report.bitwardenJson) as { items: Array<Record<string, unknown>> };
    const card = json.items.find((item) => item.type === 3);
    expect(card?.card).toEqual({ number: '4111111111111111' });
    expect(report.bitwardenCsv).not.toContain('4111111111111111');
    expect(report.bitwardenCsv.startsWith('folder,favorite,type,name,notes,fields,reprompt,login_uri')).toBe(true);
  });

  it('reads an Apple Passwords CSV that has no OTPAuth column', async () => {
    const apple = ['Title,URL,Username,Password,Notes', 'Example,https://example.com,alice,secret,note'].join('\n');
    const report = await mergeVaultSources([{ name: 'apple.csv', text: apple }]);
    expect(report.sources[0]?.format).toBe('safari-csv');
    expect(report.added).toBe(1);
    expect(JSON.parse(report.bitwardenJson).folders[0].name).toBe('Imported from Apple Passwords');
  });

  it('matches the metadata example', async () => {
    for (const example of meta.examples ?? []) {
      expect(await passwordVaultMerge(example.input)).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => passwordVaultMerge(input), { timeLimitMs: 5000 });
  });
});
