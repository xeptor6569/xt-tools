import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { buildSampleKdbx4, computeEntryTotp, inspectAndConvertVault, passwordExportViewer } from './logic.ts';
import meta from './meta.ts';

describe('passwordExportViewer', () => {
  it('decrypts a KeePass KDBX 4.0 file, unmasks ChaCha20 protected strings and computes TOTP', async () => {
    const kdbxBytes = await buildSampleKdbx4('correct-horse');
    const vault = await inspectAndConvertVault('', {
      fileBytes: kdbxBytes,
      masterPassword: 'correct-horse',
      targetFormat: 'bitwarden-csv',
      unixSeconds: 1700000000,
    });
    expect(vault.sourceFormat).toBe('kdbx-4');
    expect(vault.entries).toHaveLength(1);
    const entry = vault.entries[0]!;
    expect(entry.title).toBe('GitHub Production');
    expect(entry.folder).toBe('Work Vault');
    expect(entry.username).toBe('alice@example.com');
    expect(entry.password).toBe('hunter2-kdbx-secret');
    expect(entry.url).toBe('https://example.com/login');
    expect(entry.totp).toContain('secret=JBSWY3DPEHPK3PXP');

    const otp = computeEntryTotp(entry.totp, 1700000000);
    expect(otp?.code).toMatch(/^\d{6}$/);

    await expect(
      inspectAndConvertVault('', { fileBytes: kdbxBytes, masterPassword: 'wrong-password' }),
    ).rejects.toThrow(/Incorrect master password/);
  });

  it('parses and converts between Chrome, Bitwarden, 1Password, KeePass and Firefox exports', async () => {
    const chromeCsv = [
      'name,url,username,password,note',
      'GitHub,https://github.com,alice@example.com,correct-horse,Work account',
      'GitLab,https://gitlab.com,bob@example.com,battery-staple,DevOps',
    ].join('\n');

    const toBitwardenCsv = await inspectAndConvertVault(chromeCsv, { targetFormat: 'bitwarden-csv' });
    expect(toBitwardenCsv.sourceFormat).toBe('chrome-csv');
    expect(toBitwardenCsv.entries).toHaveLength(2);
    expect(toBitwardenCsv.converted).toContain(
      ',,login,GitHub,Work account,,0,https://github.com,alice@example.com,correct-horse,',
    );

    const toBitwardenJson = await inspectAndConvertVault(toBitwardenCsv.converted, {
      targetFormat: 'bitwarden-json',
    });
    expect(toBitwardenJson.sourceFormat).toBe('bitwarden-csv');

    const to1PasswordCsv = await inspectAndConvertVault(toBitwardenJson.converted, {
      targetFormat: '1password-csv',
    });
    expect(to1PasswordCsv.sourceFormat).toBe('bitwarden-json');
    expect(to1PasswordCsv.converted).toContain(
      'GitHub,https://github.com,alice@example.com,correct-horse,,Work account,Login',
    );

    const toKeePassCsv = await inspectAndConvertVault(to1PasswordCsv.converted, {
      targetFormat: 'keepass-csv',
    });
    expect(toKeePassCsv.sourceFormat).toBe('1password-csv');
    expect(toKeePassCsv.converted).toContain('GitHub,alice@example.com,correct-horse,https://github.com,Work account');

    const toFirefoxCsv = await inspectAndConvertVault(toKeePassCsv.converted, {
      targetFormat: 'firefox-csv',
    });
    expect(toFirefoxCsv.sourceFormat).toBe('keepass-csv');
    const fromFirefox = await inspectAndConvertVault(toFirefoxCsv.converted);
    expect(fromFirefox.sourceFormat).toBe('firefox-csv');
    expect(fromFirefox.entries).toHaveLength(2);
    expect(fromFirefox.entries[0]?.username).toBe('alice@example.com');
    expect(fromFirefox.entries[0]?.password).toBe('correct-horse');
  });

  it('parses 1Password 1PUX JSON and KeePass XML exports', async () => {
    const onePux = JSON.stringify({
      accounts: [
        {
          vaults: [
            {
              attrs: { name: 'Personal' },
              items: [
                {
                  uuid: 'item-1',
                  overview: { title: 'Proton', url: 'https://mail.proton.me' },
                  details: {
                    notesPlain: 'Encrypted mail',
                    loginFields: [
                      { designation: 'username', value: 'alice@proton.me' },
                      { designation: 'password', value: 'proton-pass' },
                    ],
                    sections: [
                      {
                        fields: [{ value: { totp: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' } }],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const parsed1P = await inspectAndConvertVault(onePux, { unixSeconds: 59 });
    expect(parsed1P.sourceFormat).toBe('1password-json');
    expect(parsed1P.entries[0]?.folder).toBe('Personal');
    expect(parsed1P.summary).toContain('totp=287082');

    const kpXml = `<KeePassFile><Root><Group><Name>Infra</Name><Entry>
      <String><Key>Title</Key><Value>SSH Bastion</Value></String>
      <String><Key>UserName</Key><Value>root</Value></String>
      <String><Key>Password</Key><Value>toor123</Value></String>
    </Entry></Group></Root></KeePassFile>`;
    const parsedKp = await inspectAndConvertVault(kpXml);
    expect(parsedKp.sourceFormat).toBe('keepass-xml');
    expect(parsedKp.entries[0]?.folder).toBe('Infra');
    expect(parsedKp.entries[0]?.title).toBe('SSH Bastion');
  });

  it('matches the metadata examples', async () => {
    for (const ex of meta.examples ?? []) {
      expect(await passwordExportViewer(ex.input)).toContain(ex.expect);
    }
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => passwordExportViewer(input), {
      malformed: ['{bad json', '<KeePassFile><unclosed', 'a,b,c\n1,2,3'],
      timeLimitMs: 5000,
    });
  });
});
