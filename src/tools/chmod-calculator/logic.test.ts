import { describe as group, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { chmodCalculator, describe, formatLike, parseMode, toChmodSymbolic, toOctal, toSymbolic } from './logic.ts';
import meta from './meta.ts';

const bits = (input: string) => parseMode(input)?.bits;
const value = (input: string, label: string) => chmodCalculator(input)?.items.find((i) => i.label === label)?.value;

group('parseMode', () => {
  it('returns null for empty input', () => {
    expect(parseMode('')).toBeNull();
    expect(chmodCalculator('  \n')).toBeNull();
  });

  it('parses octal modes', () => {
    expect(bits('755')).toBe(0o755);
    expect(bits('0644')).toBe(0o644);
    expect(bits('4755')).toBe(0o4755);
    expect(bits('1777')).toBe(0o1777);
    expect(bits('0o600')).toBe(0o600);
    expect(bits('00755')).toBe(0o755);
    expect(bits('7')).toBe(0o007);
    expect(parseMode('755')?.format).toBe('octal');
    expect(() => parseMode('17777')).toThrow(/7777/);
    expect(() => parseMode('789')).toThrow(/0–7/);
  });

  it('parses symbolic and ls-style permissions', () => {
    expect(bits('rwxr-xr-x')).toBe(0o755);
    expect(bits('rw-r--r--')).toBe(0o644);
    expect(bits('-rw-r--r--')).toBe(0o644);
    expect(bits('-rwsr-xr-x')).toBe(0o4755);
    expect(bits('-rwSr--r--')).toBe(0o4644);
    expect(bits('drwxr-sr-x')).toBe(0o2755);
    expect(bits('drwxrwxrwt')).toBe(0o1777);
    expect(bits('drwxrwxrwT')).toBe(0o1776);
    expect(bits('-rw-r--r--.')).toBe(0o644);
    expect(bits('-rw-r--r--@')).toBe(0o644);
    expect(parseMode('drwxr-sr-x')).toMatchObject({ format: 'ls', fileType: 'd' });
    expect(() => parseMode('rwxr-xr-t')).not.toThrow();
    expect(() => parseMode('rwtr-xr-x')).toThrow(/Position 3/);
    expect(() => parseMode('rwxr-xr-s')).toThrow(/Position 9/);
    expect(() => parseMode('wrxr-xr-x')).toThrow(ToolInputError);
  });

  it('applies chmod symbolic modes to 000', () => {
    expect(bits('u=rwx,g=rx,o=')).toBe(0o750);
    expect(bits('u=rwx,g=rx,o=rx')).toBe(0o755);
    expect(bits('a+x')).toBe(0o111);
    expect(bits('a=r,u+w')).toBe(0o644);
    expect(bits('ug=rw,o=r')).toBe(0o664);
    expect(bits('u=rwx,g=u,o=u-w')).toBe(0o775);
    expect(bits('u=rwxs')).toBe(0o4700);
    expect(bits('g+s')).toBe(0o2000);
    expect(bits('+t')).toBe(0o1000);
    expect(bits('o+t,a=rwx')).toBe(0o0777);
    expect(bits('a=rwx,o+t')).toBe(0o1777);
    expect(bits('u+t')).toBe(0); // t only applies to "others" or everyone, as in GNU chmod.
    expect(bits('o+s')).toBe(0);
    expect(bits('=rw')).toBe(0o666);
    expect(bits('a+X')).toBe(0);
    expect(bits('u+x,a+X')).toBe(0o111);
    expect(bits('u=rwx,u-w')).toBe(0o500);
  });

  it('explains what it assumed for relative clauses', () => {
    expect(parseMode('u=rwx,g=rx,o=')?.notes).toEqual([]);
    expect(parseMode('a+x')?.notes.join(' ')).toMatch(/starting mode of 000/);
    expect(parseMode('+x')?.notes.join(' ')).toMatch(/umask/);
    expect(parseMode('a+X')?.notes.join(' ')).toMatch(/X adds execute/);
  });

  it('rejects anything else with a helpful message', () => {
    for (const bad of ['hello', 'u=rwz', 'u=rwx,', 'rwx', 'chmod 755', 'u=rwx;g=r']) {
      expect(() => parseMode(bad), bad).toThrow(ToolInputError);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(chmodCalculator, { malformed: ['0o', '0o8', '-'.repeat(10), 'u=' + 'r'.repeat(900), ',,,'] });
  });
});

group('formatting', () => {
  it('formats octal with 3 or 4 digits', () => {
    expect(toOctal(0o755)).toBe('755');
    expect(toOctal(0o7)).toBe('007');
    expect(toOctal(0o4755)).toBe('4755');
    expect(toOctal(0o1777)).toBe('1777');
  });

  it('formats symbolic notation with special bits', () => {
    expect(toSymbolic(0o755)).toBe('rwxr-xr-x');
    expect(toSymbolic(0o4755)).toBe('rwsr-xr-x');
    expect(toSymbolic(0o4644)).toBe('rwSr--r--');
    expect(toSymbolic(0o2750)).toBe('rwxr-s---');
    expect(toSymbolic(0o1777)).toBe('rwxrwxrwt');
    expect(toSymbolic(0o1776)).toBe('rwxrwxrwT');
    expect(toSymbolic(0)).toBe('---------');
  });

  it('formats chmod symbolic commands', () => {
    expect(toChmodSymbolic(0o755)).toBe('u=rwx,g=rx,o=rx');
    expect(toChmodSymbolic(0o640)).toBe('u=rw,g=r,o=');
    expect(toChmodSymbolic(0o6755)).toBe('u=rwxs,g=rxs,o=rx');
    expect(toChmodSymbolic(0o1777)).toBe('u=rwx,g=rwx,o=rwxt');
  });

  it('round-trips every mode through every notation', () => {
    for (let m = 0; m <= 0o7777; m++) {
      expect(parseMode(toOctal(m))?.bits).toBe(m);
      expect(parseMode(toSymbolic(m))?.bits).toBe(m);
      expect(parseMode(`d${toSymbolic(m)}`)?.bits).toBe(m);
      expect(parseMode(toChmodSymbolic(m))?.bits).toBe(m);
    }
  });

  it('formats in the notation the user typed', () => {
    expect(formatLike('octal', 0o644)).toBe('644');
    expect(formatLike('symbolic', 0o644)).toBe('rw-r--r--');
    expect(formatLike('ls', 0o2755, 'd')).toBe('drwxr-sr-x');
    expect(formatLike('chmod-symbolic', 0o750)).toBe('u=rwx,g=rx,o=');
  });

  it('describes modes in plain English', () => {
    expect(describe(0o755)).toBe(
      'Owner can read, write and execute. Group can read and execute. Others can read and execute.',
    );
    expect(describe(0o640)).toBe('Owner can read and write. Group can read. Others have no access.');
    expect(describe(0o4755)).toMatch(/Setuid: runs with the owner’s privileges/);
    expect(describe(0o1777, 'd')).toMatch(/^Owner can list, create and delete entries and enter\..*Sticky/);
  });
});

group('chmodCalculator', () => {
  it('lists every representation', () => {
    expect(value('755', 'Octal')).toBe('755');
    expect(value('755', 'Symbolic')).toBe('rwxr-xr-x');
    expect(value('755', 'ls -l style')).toBe('-rwxr-xr-x');
    expect(value('755', 'Command (octal)')).toBe('chmod 755 file');
    expect(value('755', 'Command (symbolic)')).toBe('chmod u=rwx,g=rx,o=rx file');
    expect(value('drwxr-sr-x', 'Command (octal)')).toBe('chmod 2755 dir');
  });

  it('gives the matching umask', () => {
    expect(value('755', 'umask (directories)')).toBe('022');
    expect(value('755', 'umask (files)')).toBe('None');
    expect(value('644', 'umask (files)')).toBe('022');
    expect(value('600', 'umask (files)')).toBe('066');
    expect(value('700', 'umask (directories)')).toBe('077');
    expect(value('4755', 'umask (directories)')).toBe('022');
  });
});

group('meta examples', () => {
  it('produce the expected output', () => {
    for (const ex of meta.examples ?? []) {
      const text = chmodCalculator(ex.input)!
        .items.map((i) => i.value)
        .join('\n');
      expect(text).toContain(ex.expect);
    }
  });
});
