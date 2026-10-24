// Rule catalogue. IDs and wording are this project's own.

export type Severity = 'error' | 'warning' | 'info';

export interface Rule {
  severity: Severity;
  title: string;
  /** One sentence explaining why the rule exists. */
  why: string;
}

export const RULES = {
  XT1001: {
    severity: 'error',
    title: 'Unknown instruction',
    why: 'The builder stops with a parse error when it meets an instruction it does not know.',
  },
  XT1002: {
    severity: 'error',
    title: 'FROM must come first',
    why: 'Only parser directives, comments and global ARG instructions may appear before the first FROM.',
  },
  XT1003: {
    severity: 'error',
    title: 'Invalid escape directive',
    why: 'The escape directive only accepts a backslash or a backtick.',
  },
  XT1004: {
    severity: 'error',
    title: 'Missing arguments',
    why: 'Every instruction needs at least one argument, so the build fails here.',
  },
  XT1005: {
    severity: 'warning',
    title: 'Whitespace after line continuation',
    why: 'Invisible spaces after the escape character are easy to miss and some tools stop treating the line as continued.',
  },
  XT1006: {
    severity: 'error',
    title: 'Unterminated heredoc',
    why: 'Without its closing delimiter the heredoc swallows the rest of the file.',
  },
  XT1007: {
    severity: 'warning',
    title: 'Empty continuation line',
    why: 'Blank lines inside a continued instruction are deprecated and may become an error.',
  },
  XT1008: {
    severity: 'warning',
    title: 'File ends with a line continuation',
    why: 'The last instruction expects another line that never comes, which usually means something was cut off.',
  },
  XT1009: {
    severity: 'info',
    title: 'Inconsistent instruction casing',
    why: 'Instructions are case-insensitive, but mixing cases makes the file harder to read; uppercase is the convention.',
  },
  XT1101: {
    severity: 'warning',
    title: 'Base image without a tag',
    why: 'Without a tag the builder pulls "latest", so the same Dockerfile can produce different images over time.',
  },
  XT1102: {
    severity: 'warning',
    title: 'Base image uses the latest tag',
    why: 'The "latest" tag moves whenever a new version is pushed, which makes builds unpredictable.',
  },
  XT1103: {
    severity: 'error',
    title: 'Duplicate stage name',
    why: 'Stage names must be unique so that FROM and COPY --from can refer to them unambiguously.',
  },
  XT1104: {
    severity: 'error',
    title: 'COPY --from refers to an unknown stage',
    why: 'A stage can only copy from stages defined above it; anything else is pulled as an image, which is rarely intended.',
  },
  XT1105: {
    severity: 'error',
    title: 'Malformed FROM',
    why: 'FROM takes an image, optionally followed by AS and a stage name that starts with a letter.',
  },
  XT1106: {
    severity: 'info',
    title: 'Hard-coded platform',
    why: 'A fixed --platform prevents multi-platform builds; $BUILDPLATFORM or $TARGETPLATFORM keep them working.',
  },
  XT1107: {
    severity: 'info',
    title: 'AS casing differs from FROM',
    why: 'Matching the casing of FROM and AS keeps the file consistent.',
  },
  XT1108: {
    severity: 'warning',
    title: 'Undefined variable in FROM',
    why: 'Variables in FROM only come from ARG instructions placed before the first FROM, or from built-in platform arguments.',
  },
  XT1109: {
    severity: 'warning',
    title: 'COPY --from names an image',
    why: 'A --from value that is not a stage is pulled as an image; that works, but a typo in a stage name looks the same.',
  },
  XT1201: {
    severity: 'warning',
    title: 'MAINTAINER is deprecated',
    why: 'MAINTAINER was replaced by a label such as org.opencontainers.image.authors.',
  },
  XT1202: {
    severity: 'warning',
    title: 'Legacy "key value" form',
    why: 'The space-separated form only allows one variable and is deprecated; "key=value" is clearer.',
  },
  XT1301: {
    severity: 'warning',
    title: 'Final stage runs as root',
    why: 'Without a USER instruction the container runs as root, which makes a container escape far more damaging.',
  },
  XT1302: {
    severity: 'warning',
    title: 'Last USER is root',
    why: 'Switching back to root at the end means the container runs with full privileges.',
  },
  XT1303: {
    severity: 'warning',
    title: 'sudo in RUN',
    why: 'Build steps already run as the current USER; sudo adds an unneeded binary and confusing privilege changes.',
  },
  XT1401: {
    severity: 'warning',
    title: 'apt-get install without -y',
    why: 'Without -y apt-get waits for a confirmation that never comes in a build and aborts.',
  },
  XT1402: {
    severity: 'warning',
    title: 'apt-get install without --no-install-recommends',
    why: 'Recommended packages are rarely needed in an image and can add a lot of size and attack surface.',
  },
  XT1403: {
    severity: 'warning',
    title: 'apt lists not cleaned',
    why: 'The package lists in /var/lib/apt/lists stay in the layer unless they are removed in the same RUN.',
  },
  XT1404: {
    severity: 'warning',
    title: 'Upgrading all packages',
    why: 'Upgrading everything in a build makes images unpredictable; use a newer base image or pin the packages you need.',
  },
  XT1405: {
    severity: 'warning',
    title: 'apt instead of apt-get',
    why: 'apt is meant for interactive use and its command-line interface is not stable for scripts.',
  },
  XT1406: {
    severity: 'warning',
    title: 'apk add without --no-cache',
    why: 'Without --no-cache the package index stays in the layer and bloats the image.',
  },
  XT1407: {
    severity: 'warning',
    title: 'yum/dnf cache not cleaned',
    why: 'Package manager caches stay in the layer unless they are cleaned in the same RUN.',
  },
  XT1408: {
    severity: 'warning',
    title: 'Package install without a yes flag',
    why: 'Without a non-interactive flag the package manager waits for a confirmation and the build fails.',
  },
  XT1409: {
    severity: 'warning',
    title: 'pip install without --no-cache-dir',
    why: "pip keeps downloaded packages in its cache, which ends up in the image's layer.",
  },
  XT1410: {
    severity: 'info',
    title: 'npm install instead of npm ci',
    why: 'npm ci installs exactly what the lockfile says, so builds are reproducible.',
  },
  XT1411: {
    severity: 'warning',
    title: 'apt-get update on its own',
    why: 'A cached update layer goes stale, so a later install can fail or fetch outdated packages; update and install in the same RUN.',
  },
  XT1501: {
    severity: 'warning',
    title: 'Piping a download into a shell',
    why: 'Running a script straight from the network executes whatever the server sends, without any verification.',
  },
  XT1502: {
    severity: 'warning',
    title: 'cd in RUN',
    why: 'WORKDIR sets the directory for every following instruction and is easier to follow than cd inside commands.',
  },
  XT1503: {
    severity: 'info',
    title: 'Consecutive RUN instructions',
    why: 'Each RUN creates a layer; related commands joined with && produce fewer, smaller layers.',
  },
  XT1504: {
    severity: 'info',
    title: 'Pipe without pipefail',
    why: 'In a pipeline only the last command decides success, so a failing download can go unnoticed.',
  },
  XT1601: {
    severity: 'warning',
    title: 'Relative WORKDIR',
    why: 'A relative WORKDIR depends on every earlier WORKDIR, which is easy to break; absolute paths are clearer.',
  },
  XT1701: {
    severity: 'warning',
    title: 'ADD for local files',
    why: 'COPY is more predictable for local files; ADD also extracts archives and downloads URLs.',
  },
  XT1702: {
    severity: 'warning',
    title: 'ADD from a URL',
    why: 'ADD downloads without verifying the file; add --checksum, or download and verify it in a RUN step.',
  },
  XT1703: {
    severity: 'error',
    title: 'Several sources need a directory destination',
    why: 'When COPY or ADD has more than one source, the destination must be a directory ending with a slash.',
  },
  XT1801: {
    severity: 'warning',
    title: 'Shell form for CMD or ENTRYPOINT',
    why: 'In shell form the process runs under /bin/sh -c, which does not forward signals, so the container cannot stop gracefully.',
  },
  XT1802: {
    severity: 'warning',
    title: 'Instruction overridden later in the stage',
    why: 'Only the last CMD, ENTRYPOINT or HEALTHCHECK of a stage takes effect.',
  },
  XT1803: {
    severity: 'error',
    title: 'Invalid exec form',
    why: 'When the JSON array cannot be parsed the builder silently falls back to shell form and runs the brackets as a command.',
  },
  XT1901: {
    severity: 'error',
    title: 'Invalid EXPOSE',
    why: 'EXPOSE takes container ports (1–65535 or a range) with an optional /tcp, /udp or /sctp protocol.',
  },
  XT2001: {
    severity: 'warning',
    title: 'Secret in ENV or ARG',
    why: 'ENV and ARG values are stored in the image metadata and history, where anyone with the image can read them.',
  },
  XT2002: {
    severity: 'info',
    title: 'Secret passed as a build argument',
    why: 'Build arguments show up in the image history; a secret mount (RUN --mount=type=secret) keeps them out of it.',
  },
  XT2101: {
    severity: 'info',
    title: 'No HEALTHCHECK',
    why: 'Without a HEALTHCHECK, Docker cannot tell a running container from a working one.',
  },
  XT2103: {
    severity: 'error',
    title: 'Malformed HEALTHCHECK',
    why: 'HEALTHCHECK takes either NONE or CMD followed by a command.',
  },
  XT2204: {
    severity: 'error',
    title: 'Invalid ONBUILD trigger',
    why: 'ONBUILD cannot wrap FROM, MAINTAINER or another ONBUILD.',
  },
} as const satisfies Record<string, Rule>;

export type RuleId = keyof typeof RULES;
