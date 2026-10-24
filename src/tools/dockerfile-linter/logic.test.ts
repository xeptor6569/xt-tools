import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { dockerfileLinter, MAX_FINDINGS, RULES, type RuleId } from './logic.ts';
import meta from './meta.ts';
import { parseDockerfile, splitArgs } from './parser.ts';

/** A good final stage, appended so tests only see the findings they are about. */
const TAIL = '\nUSER app\nHEALTHCHECK CMD ["true"]\nCMD ["app"]';

const lint = (df: string) => dockerfileLinter(df).findings;
const rules = (df: string) => lint(df).map((f) => f.rule);
const has = (df: string, rule: RuleId) => rules(df).includes(rule);
const find = (df: string, rule: RuleId) => lint(df).find((f) => f.rule === rule);

describe('parser', () => {
  it('joins continuations, skips comments inside them and keeps line numbers', () => {
    const p = parseDockerfile('FROM a:1\n\n# note\nRUN echo a \\\n  # inside\n  && echo b\nCMD ["x"]');
    expect(p.instructions.map((i) => [i.keyword, i.line])).toEqual([
      ['FROM', 1],
      ['RUN', 4],
      ['CMD', 7],
    ]);
    expect(p.instructions[1]!.rest).toBe('echo a   && echo b');
    expect(p.instructions[2]!.json).toEqual(['x']);
  });

  it('reads parser directives and the backtick escape', () => {
    const p = parseDockerfile('# syntax=docker/dockerfile:1\n# escape=`\nFROM windows:1\nRUN dir `\n  C:\\');
    expect(p.directives.get('syntax')?.value).toBe('docker/dockerfile:1');
    expect(p.escape).toBe('`');
    expect(p.instructions[1]!.rest).toBe('dir   C:\\');
  });

  it('stops looking for directives after the first other line', () => {
    const p = parseDockerfile('FROM a:1\n# escape=`\nRUN x \\\n y');
    expect(p.escape).toBe('\\');
    expect(p.instructions).toHaveLength(2);
  });

  it('parses flags and heredocs', () => {
    const p = parseDockerfile(
      'FROM a:1\nRUN --mount=type=cache,target=/root/.cache --network=none <<EOF\npip install x\nEOF\nCOPY <<-A <<B /dst/\n\tone\n\tA\ntwo\nB\nUSER x',
    );
    const run = p.instructions[1]!;
    expect(run.flags).toEqual([
      { name: 'mount', value: 'type=cache,target=/root/.cache' },
      { name: 'network', value: 'none' },
    ]);
    expect(run.heredocs).toEqual([{ name: 'EOF', body: 'pip install x', chomp: false }]);
    expect(p.instructions[2]!.heredocs.map((h) => h.body)).toEqual(['one', 'two']);
    expect(p.instructions[3]!.keyword).toBe('USER');
  });

  it('handles CRLF line endings', () => {
    const p = parseDockerfile('FROM a:1\r\nRUN a \\\r\n  b\r\n');
    expect(p.instructions[1]!.rest).toBe('a   b');
    expect(p.problems).toEqual([]);
  });

  it('splits arguments with quotes', () => {
    expect(splitArgs(`A="b c" D='e' f\\ g`)).toEqual(['A=b c', 'D=e', 'f g']);
  });
});

describe('dockerfileLinter', () => {
  it('matches the meta examples', () => {
    for (const ex of meta.examples ?? []) {
      expect(
        lint(ex.input)
          .map((f) => f.message)
          .join('\n'),
      ).toContain(ex.expect);
    }
  });

  it('reports nothing for a clean Dockerfile', () => {
    const df = [
      '# syntax=docker/dockerfile:1',
      'ARG NODE_VERSION=22',
      'FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS build',
      'WORKDIR /src',
      'COPY package.json package-lock.json ./',
      'RUN --mount=type=cache,target=/root/.npm npm ci',
      'COPY . .',
      'RUN npm run build',
      '',
      'FROM nginx:1.27-alpine',
      'RUN apk add --no-cache curl \\',
      '    && addgroup -S app && adduser -S app -G app',
      'COPY --from=build /src/dist /usr/share/nginx/html',
      'EXPOSE 8080/tcp',
      'USER app',
      'HEALTHCHECK --interval=30s CMD ["curl", "-f", "localhost:8080"]',
      'CMD ["nginx", "-g", "daemon off;"]',
    ].join('\n');
    expect(lint(df)).toEqual([]);
  });

  it('includes a reason for every finding and uses known rules', () => {
    const findings = lint('FROM ubuntu\nRUN apt-get install curl\nCMD run');
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(RULES[f.rule].why).toBe(f.why);
      expect(f.severity).toBe(RULES[f.rule].severity);
      expect(f.line).toBeGreaterThan(0);
    }
  });

  it('every rule has a sentence explaining it', () => {
    for (const [id, rule] of Object.entries(RULES)) {
      expect(id).toMatch(/^XT\d{4}$/);
      expect(rule.why).toMatch(/^[A-Za-z].*\.$/);
    }
  });

  it('sorts by line and counts severities', () => {
    const r = dockerfileLinter('FROM a\nCOPPY x y\nMAINTAINER me' + TAIL);
    expect(r.findings.map((f) => f.line)).toEqual([...r.findings.map((f) => f.line)].sort((a, b) => a - b));
    expect(r.counts).toEqual({ error: 1, warning: 2, info: 0 });
    expect(r.instructions).toBe(6);
  });

  it('returns no findings for empty input', () => {
    expect(dockerfileLinter('')).toEqual({
      findings: [],
      counts: { error: 0, warning: 0, info: 0 },
      instructions: 0,
      truncated: false,
    });
    expect(lint('# just a comment\n\n')).toEqual([]);
  });

  it('caps the number of findings', () => {
    const r = dockerfileLinter('X\n'.repeat(MAX_FINDINGS + 50));
    expect(r.findings).toHaveLength(MAX_FINDINGS);
    expect(r.truncated).toBe(true);
  });

  it('rejects input over 1 MB', () => {
    expect(() => dockerfileLinter('a'.repeat(1_000_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(dockerfileLinter, {
      malformed: [
        'FROM',
        'RUN <<EOF',
        'FROM a AS\nCOPY --from= x',
        'FROM a\nRUN [',
        'FROM a\nRUN ["a", 1]',
        'EXPOSE 99999999999999999999',
        '# escape=x\nFROM a \\',
        `FROM a\nRUN ${'$('.repeat(5000)}`,
        `FROM a\nRUN ${'"'.repeat(5001)}`,
        'FROM a\n'.repeat(20000),
        'RUN a \\\n'.repeat(20000),
      ],
    });
  });

  describe('syntax rules', () => {
    it('XT1001 unknown instruction, with a suggestion', () => {
      expect(find('FROM a:1\nCOPPY a b' + TAIL, 'XT1001')?.message).toMatch(/Did you mean COPY\?/);
      expect(find('FROM a:1\nFOOBARBAZQUX x' + TAIL, 'XT1001')?.message).not.toMatch(/Did you mean/);
      expect(has('FROM a:1\ncopy a b' + TAIL, 'XT1001')).toBe(false);
    });

    it('XT1002 FROM first (ARG allowed)', () => {
      expect(find('RUN x\nFROM a:1' + TAIL, 'XT1002')?.line).toBe(1);
      expect(has('ARG V=1\nFROM a:${V}' + TAIL, 'XT1002')).toBe(false);
      expect(find('RUN x', 'XT1002')?.message).toMatch(/before the first FROM/);
      expect(find('ARG X=1', 'XT1002')?.message).toMatch(/no FROM/);
    });

    it('XT1003 invalid escape directive', () => {
      expect(has('# escape=x\nFROM a:1' + TAIL, 'XT1003')).toBe(true);
      expect(has('# escape=`\nFROM a:1' + TAIL, 'XT1003')).toBe(false);
    });

    it('XT1004 missing arguments', () => {
      expect(has('FROM a:1\nRUN' + TAIL, 'XT1004')).toBe(true);
      expect(has('FROM a:1\nCOPY onlyone' + TAIL, 'XT1004')).toBe(true);
      expect(has('FROM a:1\nRUN x' + TAIL, 'XT1004')).toBe(false);
    });

    it('XT1005 whitespace after a continuation', () => {
      expect(find('FROM a:1\nRUN a \\  \n  && b' + TAIL, 'XT1005')?.line).toBe(2);
      expect(has('FROM a:1\nRUN a \\\n  && b' + TAIL, 'XT1005')).toBe(false);
    });

    it('XT1006 unterminated heredoc', () => {
      expect(has('FROM a:1\nRUN <<EOF\necho hi\n', 'XT1006')).toBe(true);
      expect(has('FROM a:1\nRUN <<EOF\necho hi\nEOF' + TAIL, 'XT1006')).toBe(false);
    });

    it('XT1007 blank line inside a continuation', () => {
      expect(find('FROM a:1\nRUN a \\\n\n  && b' + TAIL, 'XT1007')?.line).toBe(3);
      expect(has('FROM a:1\nRUN a \\\n  && b\n\nUSER x' + TAIL, 'XT1007')).toBe(false);
    });

    it('XT1008 file ends with a continuation', () => {
      expect(has('FROM a:1' + TAIL + '\nRUN a \\', 'XT1008')).toBe(true);
      expect(has('FROM a:1' + TAIL + '\nRUN a', 'XT1008')).toBe(false);
    });

    it('XT1009 mixed instruction casing flags the minority', () => {
      const f = lint('FROM a:1\nrun x\nRUN y' + TAIL).filter((x) => x.rule === 'XT1009');
      expect(f.map((x) => x.line)).toEqual([2]);
      expect(has('from a:1\nrun x\nuser app\nhealthcheck cmd true\ncmd ["x"]', 'XT1009')).toBe(false);
    });
  });

  describe('FROM and stages', () => {
    it('XT1101 / XT1102 untagged and latest images', () => {
      expect(has('FROM ubuntu' + TAIL, 'XT1101')).toBe(true);
      expect(has('FROM localhost:5000/ubuntu' + TAIL, 'XT1101')).toBe(true);
      expect(has('FROM ubuntu:latest' + TAIL, 'XT1102')).toBe(true);
      for (const ok of ['ubuntu:24.04', 'scratch', 'ubuntu@sha256:abc', 'localhost:5000/ubuntu:1', '$BASE']) {
        expect(rules(`ARG BASE=x\nFROM ${ok}` + TAIL), ok).not.toEqual(expect.arrayContaining(['XT1101']));
        expect(rules(`ARG BASE=x\nFROM ${ok}` + TAIL), ok).not.toEqual(expect.arrayContaining(['XT1102']));
      }
      expect(has('FROM node:22 AS build\nFROM build' + TAIL, 'XT1101')).toBe(false);
    });

    it('XT1103 duplicate stage names (case-insensitive)', () => {
      expect(find('FROM a:1 AS x\nFROM b:1 AS X' + TAIL, 'XT1103')?.line).toBe(2);
      expect(has('FROM a:1 AS x\nFROM b:1 AS y' + TAIL, 'XT1103')).toBe(false);
    });

    it('XT1104 / XT1109 COPY --from references', () => {
      const base = 'FROM a:1 AS build\nFROM b:1 AS final\n';
      expect(has(base + 'COPY --from=build /a /b' + TAIL, 'XT1104')).toBe(false);
      expect(has(base + 'COPY --from=0 /a /b' + TAIL, 'XT1104')).toBe(false);
      expect(has(base + 'COPY --from=nginx:1.27 /a /b' + TAIL, 'XT1104')).toBe(false);
      expect(has(base + 'COPY --from=ghcr.io/x/y /a /b' + TAIL, 'XT1104')).toBe(false);
      expect(find(base + 'COPY --from=biuld /a /b' + TAIL, 'XT1104')?.message).toMatch(/did you mean "build"/);
      expect(has(base + 'COPY --from=1 /a /b' + TAIL, 'XT1104')).toBe(true);
      expect(has(base + 'COPY --from=final /a /b' + TAIL, 'XT1104')).toBe(true);
      expect(find('FROM a:1 AS one\nCOPY --from=two /a /b\nFROM b:1 AS two' + TAIL, 'XT1104')?.message).toMatch(
        /defined later, on line 3/,
      );
      expect(has(base + 'COPY --from=alpine /a /b' + TAIL, 'XT1109')).toBe(true);
      expect(has(base + 'COPY --from=alpine /a /b' + TAIL, 'XT1104')).toBe(false);
    });

    it('XT1105 malformed FROM', () => {
      expect(has('FROM a:1 AS 1st' + TAIL, 'XT1105')).toBe(true);
      expect(has('FROM a:1 b:2' + TAIL, 'XT1105')).toBe(true);
      expect(has('FROM a:1 AS ok-name.2' + TAIL, 'XT1105')).toBe(false);
    });

    it('XT1106 hard-coded platform', () => {
      expect(has('FROM --platform=linux/amd64 a:1' + TAIL, 'XT1106')).toBe(true);
      expect(has('FROM --platform=$TARGETPLATFORM a:1' + TAIL, 'XT1106')).toBe(false);
    });

    it('XT1107 AS casing', () => {
      expect(has('FROM a:1 as b' + TAIL, 'XT1107')).toBe(true);
      expect(has('FROM a:1 AS b' + TAIL, 'XT1107')).toBe(false);
    });

    it('XT1108 undefined variable in FROM', () => {
      expect(has('FROM node:${VERSION}' + TAIL, 'XT1108')).toBe(true);
      expect(has('ARG VERSION=22\nFROM node:${VERSION}' + TAIL, 'XT1108')).toBe(false);
      expect(has('FROM --platform=$BUILDPLATFORM golang:1.23' + TAIL, 'XT1108')).toBe(false);
      expect(has('FROM a:1\nARG V=1\nFROM b:$V' + TAIL, 'XT1108')).toBe(true);
    });
  });

  describe('deprecations and users', () => {
    it('XT1201 MAINTAINER', () => {
      expect(has('FROM a:1\nMAINTAINER me' + TAIL, 'XT1201')).toBe(true);
      expect(has('FROM a:1\nLABEL org.opencontainers.image.authors=me' + TAIL, 'XT1201')).toBe(false);
    });

    it('XT1202 legacy key value form', () => {
      expect(has('FROM a:1\nENV A b c' + TAIL, 'XT1202')).toBe(true);
      expect(has('FROM a:1\nLABEL version 1' + TAIL, 'XT1202')).toBe(true);
      expect(has('FROM a:1\nENV A="b c" D=e' + TAIL, 'XT1202')).toBe(false);
    });

    it('XT1301 / XT1302 user of the final stage', () => {
      expect(find('FROM a:1\nCMD ["x"]', 'XT1301')?.line).toBe(1);
      expect(has('FROM a:1 AS b\nUSER app\nFROM c:1\nUSER app', 'XT1301')).toBe(false);
      expect(has('FROM a:1 AS b\nUSER app\nFROM c:1', 'XT1301')).toBe(true);
      expect(has('FROM a:1 AS b\nUSER app\nFROM b', 'XT1301')).toBe(false);
      for (const u of ['root', '0', '0:0', 'root:root']) expect(has(`FROM a:1\nUSER ${u}`, 'XT1302'), u).toBe(true);
      expect(has('FROM a:1\nUSER root\nRUN x\nUSER 1000', 'XT1302')).toBe(false);
      expect(has('FROM a:1\nUSER rooty', 'XT1302')).toBe(false);
    });

    it('XT1303 sudo', () => {
      expect(has('FROM a:1\nRUN sudo -E make install' + TAIL, 'XT1303')).toBe(true);
      expect(has('FROM a:1\nRUN echo sudo' + TAIL, 'XT1303')).toBe(false);
    });
  });

  describe('package managers', () => {
    const apt = (cmd: string) => `FROM debian:12\nRUN ${cmd}${TAIL}`;
    const goodApt = 'apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*';

    it('accepts a well-formed apt-get install', () => {
      expect(lint(apt(goodApt))).toEqual([]);
      expect(lint(apt(goodApt.replace('-y', '-qq')))).toEqual([]);
      expect(lint(apt(goodApt.replace('-y', '-yq')))).toEqual([]);
    });

    it('XT1401 apt-get install without -y', () => {
      expect(has(apt(goodApt.replace('-y ', '')), 'XT1401')).toBe(true);
    });

    it('XT1402 apt-get install without --no-install-recommends', () => {
      expect(has(apt(goodApt.replace('--no-install-recommends ', '')), 'XT1402')).toBe(true);
      const conf = `echo 'APT::Install-Recommends "0";' > /etc/apt/apt.conf.d/norec`;
      expect(
        has(`FROM debian:12\nRUN ${conf}\nRUN ${goodApt.replace('--no-install-recommends ', '')}${TAIL}`, 'XT1402'),
      ).toBe(false);
    });

    it('XT1403 apt lists not cleaned, unless a cache mount is used', () => {
      expect(has(apt('apt-get update && apt-get install -y --no-install-recommends curl'), 'XT1403')).toBe(true);
      expect(
        has(
          `FROM debian:12\nRUN --mount=type=cache,target=/var/lib/apt,sharing=locked apt-get update && apt-get install -y --no-install-recommends curl${TAIL}`,
          'XT1403',
        ),
      ).toBe(false);
    });

    it('XT1404 upgrading every package', () => {
      expect(has(apt('apt-get update && apt-get -y dist-upgrade'), 'XT1404')).toBe(true);
      expect(has(apt('apk upgrade'), 'XT1404')).toBe(true);
      expect(has(apt('dnf -y update && dnf clean all'), 'XT1404')).toBe(true);
      expect(has(apt('dnf -y update openssl && dnf clean all'), 'XT1404')).toBe(false);
      expect(has(apt(goodApt), 'XT1404')).toBe(false);
    });

    it('XT1405 apt in scripts', () => {
      expect(has(apt('apt install -y curl'), 'XT1405')).toBe(true);
      expect(has(apt('apt-get install -y curl'), 'XT1405')).toBe(false);
    });

    it('XT1406 apk add without --no-cache', () => {
      expect(has(apt('apk add curl'), 'XT1406')).toBe(true);
      expect(has(apt('apk --no-cache add curl'), 'XT1406')).toBe(false);
      expect(has(apt('apk add curl && rm -rf /var/cache/apk/*'), 'XT1406')).toBe(false);
    });

    it('XT1407 / XT1408 yum and dnf', () => {
      expect(has(apt('yum install -y httpd'), 'XT1407')).toBe(true);
      expect(has(apt('yum install -y httpd && yum clean all'), 'XT1407')).toBe(false);
      expect(has(apt('dnf install -y httpd && rm -rf /var/cache/dnf'), 'XT1407')).toBe(false);
      expect(has(apt('dnf install httpd && dnf clean all'), 'XT1408')).toBe(true);
      expect(has(apt('zypper -n install vim && zypper clean'), 'XT1408')).toBe(false);
      expect(has(apt('microdnf install vim && microdnf clean all'), 'XT1408')).toBe(false);
    });

    it('XT1409 pip install without --no-cache-dir', () => {
      expect(has(apt('pip install flask'), 'XT1409')).toBe(true);
      expect(has(apt('python3 -m pip install -r requirements.txt'), 'XT1409')).toBe(true);
      expect(has(apt('pip install --no-cache-dir flask'), 'XT1409')).toBe(false);
      expect(has(`FROM python:3.13\nENV PIP_NO_CACHE_DIR=1\nRUN pip install flask${TAIL}`, 'XT1409')).toBe(false);
      expect(
        has(`FROM python:3.13\nRUN --mount=type=cache,target=/root/.cache/pip pip install x${TAIL}`, 'XT1409'),
      ).toBe(false);
      expect(has(apt('pip download flask'), 'XT1409')).toBe(false);
    });

    it('XT1410 npm install where npm ci fits', () => {
      expect(has(apt('npm install'), 'XT1410')).toBe(true);
      expect(has(apt('npm i --omit=dev'), 'XT1410')).toBe(true);
      expect(has(apt('npm install -g pnpm'), 'XT1410')).toBe(false);
      expect(has(apt('npm ci'), 'XT1410')).toBe(false);
    });

    it('XT1411 apt-get update on its own', () => {
      expect(has(apt('apt-get update'), 'XT1411')).toBe(true);
      expect(has(apt(goodApt), 'XT1411')).toBe(false);
    });
  });

  describe('RUN', () => {
    const run = (cmd: string) => `FROM a:1\nRUN ${cmd}${TAIL}`;

    it('XT1501 downloads piped into a shell', () => {
      expect(has(run('curl -fsSL example.com/install.sh | sh'), 'XT1501')).toBe(true);
      expect(has(run('wget -qO- example.com/x | sudo bash -s --'), 'XT1501')).toBe(true);
      expect(has(run('bash -c "$(curl -fsSL example.com/x)"'), 'XT1501')).toBe(true);
      expect(has(run('bash <(curl -s example.com/x)'), 'XT1501')).toBe(true);
      expect(has(run('curl -fsSLo /tmp/x.sh example.com/x.sh && sha256sum -c sum && sh /tmp/x.sh'), 'XT1501')).toBe(
        false,
      );
      expect(has(run('curl example.com | tar -xz'), 'XT1501')).toBe(false);
    });

    it('XT1502 cd in RUN', () => {
      expect(has(run('cd /src && make'), 'XT1502')).toBe(true);
      expect(has(run('make -C /src'), 'XT1502')).toBe(false);
      expect(has(run('echo cd'), 'XT1502')).toBe(false);
    });

    it('XT1503 consecutive RUN instructions (reported once per chain)', () => {
      const f = lint('FROM a:1\nRUN a\nRUN b\nRUN c\nCOPY x /x\nRUN d' + TAIL).filter((x) => x.rule === 'XT1503');
      expect(f.map((x) => x.line)).toEqual([3]);
      expect(has('FROM a:1\nRUN a\nRUN --mount=type=cache,target=/c b' + TAIL, 'XT1503')).toBe(false);
    });

    it('XT1504 pipes without pipefail', () => {
      expect(has(run('wget -O - example.com | tar xz'), 'XT1504')).toBe(true);
      expect(has(run('set -o pipefail && wget -O - example.com | tar xz'), 'XT1504')).toBe(false);
      expect(
        has('FROM a:1\nSHELL ["/bin/bash", "-o", "pipefail", "-c"]\nRUN wget -O - x | tar xz' + TAIL, 'XT1504'),
      ).toBe(false);
      expect(has(run('a || b'), 'XT1504')).toBe(false);
    });

    it('checks exec-form and heredoc scripts too', () => {
      expect(has(run('["/bin/sh", "-c", "apk add curl"]'), 'XT1406')).toBe(true);
      expect(has('FROM a:1\nRUN <<EOF\napk add curl\nEOF' + TAIL, 'XT1406')).toBe(true);
    });

    it('accepts secret mounts', () => {
      expect(
        lint('FROM a:1\nRUN --mount=type=secret,id=npm_token,env=NPM_TOKEN npm ci --ignore-scripts' + TAIL),
      ).toEqual([]);
    });
  });

  describe('files and paths', () => {
    it('XT1601 relative WORKDIR', () => {
      expect(has('FROM a:1\nWORKDIR app' + TAIL, 'XT1601')).toBe(true);
      for (const ok of ['/app', '$HOME/app', '"/my app"', 'C:\\app']) {
        expect(has(`FROM a:1\nWORKDIR ${ok}` + TAIL, 'XT1601'), ok).toBe(false);
      }
    });

    it('XT1701 / XT1702 ADD', () => {
      expect(has('FROM a:1\nADD app.js /app/' + TAIL, 'XT1701')).toBe(true);
      expect(has('FROM a:1\nADD rootfs.tar.gz /' + TAIL, 'XT1701')).toBe(false);
      expect(has('FROM a:1\nADD https://example.com/x.tgz /tmp/' + TAIL, 'XT1702')).toBe(true);
      expect(has('FROM a:1\nADD https://example.com/x.tgz /tmp/' + TAIL, 'XT1701')).toBe(false);
      expect(has('FROM a:1\nADD --checksum=sha256:abc https://example.com/x.tgz /tmp/' + TAIL, 'XT1702')).toBe(false);
      expect(has('FROM a:1\nCOPY app.js /app/' + TAIL, 'XT1701')).toBe(false);
    });

    it('XT1703 several sources need a directory', () => {
      expect(has('FROM a:1\nCOPY a b /dst' + TAIL, 'XT1703')).toBe(true);
      expect(has('FROM a:1\nCOPY ["a", "b", "/dst"]' + TAIL, 'XT1703')).toBe(true);
      expect(has('FROM a:1\nCOPY a b /dst/' + TAIL, 'XT1703')).toBe(false);
      expect(has('FROM a:1\nCOPY a b ./' + TAIL, 'XT1703')).toBe(false);
      expect(has('FROM a:1\nCOPY a /dst' + TAIL, 'XT1703')).toBe(false);
    });
  });

  describe('CMD, ENTRYPOINT and exec form', () => {
    it('XT1801 shell form, with an exec-form suggestion', () => {
      expect(find('FROM a:1\nUSER x\nHEALTHCHECK NONE\nCMD npm start', 'XT1801')?.message).toContain(
        'CMD ["npm", "start"]',
      );
      expect(find('FROM a:1\nENTRYPOINT ./run.sh && x' + TAIL, 'XT1801')?.message).toMatch(/exec/);
      expect(has('FROM a:1' + TAIL, 'XT1801')).toBe(false);
    });

    it('XT1802 overridden CMD, ENTRYPOINT and HEALTHCHECK', () => {
      const f = lint('FROM a:1\nCMD ["a"]\nENTRYPOINT ["x"]\nCMD ["b"]\nUSER x\nHEALTHCHECK NONE').filter(
        (x) => x.rule === 'XT1802',
      );
      expect(f.map((x) => [x.line, x.message])).toEqual([[2, 'This CMD is replaced by the CMD on line 4.']]);
      expect(has('FROM a:1 AS b\nCMD ["a"]\nFROM c:1\nCMD ["b"]\nUSER x\nHEALTHCHECK NONE', 'XT1802')).toBe(false);
    });

    it('XT1803 invalid exec form', () => {
      expect(find("FROM a:1\nUSER x\nHEALTHCHECK NONE\nCMD ['node', 'app.js']", 'XT1803')?.message).toMatch(
        /single quotes/,
      );
      expect(has('FROM a:1\nRUN ["a", 1]' + TAIL, 'XT1803')).toBe(true);
      expect(has('FROM a:1\nSHELL /bin/bash -c' + TAIL, 'XT1803')).toBe(true);
      expect(has('FROM a:1\nRUN ["echo", "hi"]' + TAIL, 'XT1803')).toBe(false);
      expect(has("FROM a:1\nCMD ['node', 'app.js']\nUSER x\nHEALTHCHECK NONE", 'XT1801')).toBe(false);
    });
  });

  describe('EXPOSE', () => {
    it('XT1901 invalid ports and protocols', () => {
      expect(find('FROM a:1\nEXPOSE 8080:80' + TAIL, 'XT1901')?.message).toMatch(/docker run -p/);
      expect(has('FROM a:1\nEXPOSE 0' + TAIL, 'XT1901')).toBe(true);
      expect(has('FROM a:1\nEXPOSE 70000' + TAIL, 'XT1901')).toBe(true);
      expect(has('FROM a:1\nEXPOSE 90-80' + TAIL, 'XT1901')).toBe(true);
      expect(has('FROM a:1\nEXPOSE 80/http' + TAIL, 'XT1901')).toBe(true);
      expect(has('FROM a:1\nEXPOSE 80 443/tcp 53/UDP 7000-7010 $PORT' + TAIL, 'XT1901')).toBe(false);
    });
  });

  describe('secrets', () => {
    it('XT2001 secrets with literal values', () => {
      expect(has('FROM a:1\nENV DB_PASSWORD=hunter2' + TAIL, 'XT2001')).toBe(true);
      expect(has('FROM a:1\nENV GITHUB_TOKEN ghp_x' + TAIL, 'XT2001')).toBe(true);
      expect(has('FROM a:1\nARG API_KEY=abc' + TAIL, 'XT2001')).toBe(true);
      expect(has('FROM a:1\nENV DB_PASSWORD_FILE=/run/secrets/db' + TAIL, 'XT2001')).toBe(false);
      expect(has('FROM a:1\nENV DB_PASSWORD=$DB_PASSWORD' + TAIL, 'XT2001')).toBe(false);
      expect(has('FROM a:1\nENV GPG_KEY=ABCDEF PASSPORT=x' + TAIL, 'XT2001')).toBe(false);
    });

    it('XT2002 secret build arguments without a value', () => {
      expect(has('FROM a:1\nARG NPM_TOKEN' + TAIL, 'XT2002')).toBe(true);
      expect(has('FROM a:1\nARG VERSION' + TAIL, 'XT2002')).toBe(false);
    });
  });

  describe('HEALTHCHECK and ONBUILD', () => {
    it('XT2101 no HEALTHCHECK in the final stage', () => {
      expect(has('FROM a:1\nUSER x', 'XT2101')).toBe(true);
      expect(has('FROM a:1\nUSER x\nHEALTHCHECK NONE', 'XT2101')).toBe(false);
      expect(has('FROM a:1 AS base\nHEALTHCHECK CMD x\nFROM base\nUSER x', 'XT2101')).toBe(false);
    });

    it('XT2103 malformed HEALTHCHECK', () => {
      expect(has('FROM a:1\nUSER x\nHEALTHCHECK curl localhost', 'XT2103')).toBe(true);
      expect(has('FROM a:1\nUSER x\nHEALTHCHECK --interval=5s', 'XT2103')).toBe(true);
      expect(has('FROM a:1\nUSER x\nHEALTHCHECK --interval=5s CMD curl -f localhost', 'XT2103')).toBe(false);
    });

    it('XT2204 invalid ONBUILD triggers', () => {
      expect(has('FROM a:1\nONBUILD FROM b' + TAIL, 'XT2204')).toBe(true);
      expect(has('FROM a:1\nONBUILD COPY . /app' + TAIL, 'XT2204')).toBe(false);
    });
  });
});
