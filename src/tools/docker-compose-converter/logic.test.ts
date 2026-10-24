import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { composeToRun, durationSeconds } from './compose-to-run.ts';
import { dockerComposeConverter } from './logic.ts';
import meta from './meta.ts';
import { imageName, runToCompose } from './run-to-compose.ts';
import { LITERAL_DOLLAR, quoteComposeValue, quoteLiteral, splitCommands } from './shell.ts';

type Obj = Record<string, unknown>;

/** Converts docker run text and returns the parsed YAML, so tests compare structure. */
function compose(input: string): { yaml: Obj; services: Record<string, Obj>; text: string; notes: string[] } {
  const { text, notes } = dockerComposeConverter(input);
  const yaml = parse(text) as Obj;
  return { yaml, services: yaml.services as Record<string, Obj>, text, notes: notes.map((n) => n.message) };
}

function service(input: string): Obj {
  return Object.values(compose(input).services)[0]!;
}

describe('shell tokenizer', () => {
  const words = (s: string) => splitCommands(s).map((c) => c.words);

  it('handles quotes, escapes and continuations', () => {
    expect(words(`docker run -e "A=b c" -e 'D="e"' f\\ g \\\n  img`)).toEqual([
      ['docker', 'run', '-e', 'A=b c', '-e', 'D="e"', 'f g', 'img'],
    ]);
    expect(words('a "x\\"y\\\\z\\n"')).toEqual([['a', 'x"y\\z\\n']]);
    expect(words("a ''")).toEqual([['a', '']]);
    expect(words('a \\\r\n b')).toEqual([['a', 'b']]);
  });

  it('splits commands on newlines, ;, && and ||', () => {
    expect(words('a 1; b 2 && c\nd || e')).toEqual([['a', '1'], ['b', '2'], ['c'], ['d'], ['e']]);
    expect(splitCommands('a | b').map((c) => c.end)).toEqual(['|', 'eof']);
  });

  it('skips comments and keeps # inside words', () => {
    expect(words('# hello\na b#c # note')).toEqual([['a', 'b#c']]);
  });

  it('keeps expansions verbatim and marks literal dollars', () => {
    expect(words('a $HOME "${X:-y}" $(pwd)/d "$(echo "a b")" `id -u`')).toEqual([
      ['a', '$HOME', '${X:-y}', '$(pwd)/d', '$(echo "a b")', '`id -u`'],
    ]);
    expect(words("a '$HOME' \\$X")).toEqual([['a', `${LITERAL_DOLLAR}HOME`, `${LITERAL_DOLLAR}X`]]);
    expect(words('a $ b')).toEqual([['a', LITERAL_DOLLAR, 'b']]);
  });

  it('reports unterminated quotes with a line number', () => {
    expect(() => splitCommands("a\nb 'c")).toThrow(/single quote on line 2/);
    expect(() => splitCommands('a "c')).toThrow(ToolInputError);
    expect(() => splitCommands('a $(c')).toThrow(ToolInputError);
  });

  it('quotes values for the shell', () => {
    expect(quoteLiteral('nginx:1.27')).toBe('nginx:1.27');
    expect(quoteLiteral('a b')).toBe("'a b'");
    expect(quoteLiteral("it's")).toBe("'it'\\''s'");
    expect(quoteLiteral('')).toBe("''");
    expect(quoteComposeValue('HOME=$HOME')).toBe('"HOME=$HOME"');
    expect(quoteComposeValue('A=${X:-"q"} `b`')).toBe('"A=${X:-"q"} \\`b\\`"');
    expect(quoteComposeValue('P=pa$$word')).toBe("'P=pa$word'");
  });
});

describe('docker run → Compose', () => {
  it('converts the meta examples', () => {
    for (const ex of meta.examples ?? []) expect(dockerComposeConverter(ex.input).text).toContain(ex.expect);
  });

  it('converts a typical command', () => {
    const { text, notes } = compose('docker run -d -p 8080:80 --name web nginx:1.27');
    expect(text).toBe(
      'services:\n  web:\n    image: nginx:1.27\n    container_name: web\n    ports:\n      - "8080:80"\n',
    );
    expect(text).not.toContain('version');
    expect(notes.join('\n')).toMatch(/-d: Compose runs services in the background/);
  });

  it('accepts docker container run, podman, sudo, prompts and global options', () => {
    for (const cmd of [
      'docker container run nginx',
      'sudo docker run nginx',
      '$ docker run nginx',
      'podman run nginx',
      'docker --context prod run nginx',
      'docker create nginx',
      '/usr/bin/docker run nginx',
    ]) {
      expect(service(cmd).image, cmd).toBe('nginx');
    }
  });

  it('parses combined short flags and = values', () => {
    const s = service('docker run -dit -p8080:80 -e=FOO --publish=443:443/udp -vdata:/data -uapp img');
    expect(s).toMatchObject({
      stdin_open: true,
      tty: true,
      ports: ['8080:80', '443:443/udp'],
      environment: ['FOO'],
      volumes: ['data:/data'],
      user: 'app',
    });
    expect(service('docker run --privileged=false --init=true img')).toEqual({ image: 'img', init: true });
  });

  it('maps the common options', () => {
    const s = service(
      [
        'docker run --name api -h api.local --domainname example.com -w /srv -u 1000:1000',
        '--restart unless-stopped --env-file .env -l a=b --label c --expose 9000',
        '--tmpfs /run:rw,size=64m --cap-add NET_ADMIN --cap-drop ALL --device /dev/fuse',
        '--dns 1.1.1.1 --dns-search corp --add-host db:10.0.0.2 --privileged --read-only --init',
        '-m 512m --memory-reservation 256m --cpus 1.5 --cpu-shares 512 --pids-limit 100',
        '--log-driver json-file --log-opt max-size=10m --platform linux/amd64 --pull always',
        '--pid host --ipc shareable --shm-size 1g --sysctl net.core.somaxconn=1024',
        '--security-opt no-new-privileges --stop-signal SIGINT --stop-timeout 30 --group-add audio',
        '--runtime runsc --userns host --cgroupns private --mac-address 02:42:ac:11:00:02',
        '--annotation com.example=1 --label-file labels.txt --oom-score-adj -500',
        'ghcr.io/acme/api:2.1 serve --port 9000',
      ].join(' '),
    );
    expect(s).toEqual({
      image: 'ghcr.io/acme/api:2.1',
      container_name: 'api',
      hostname: 'api.local',
      domainname: 'example.com',
      platform: 'linux/amd64',
      pull_policy: 'always',
      restart: 'unless-stopped',
      init: true,
      privileged: true,
      read_only: true,
      user: '1000:1000',
      group_add: ['audio'],
      working_dir: '/srv',
      command: ['serve', '--port', '9000'],
      env_file: ['.env'],
      labels: ['a=b', 'c'],
      label_file: ['labels.txt'],
      annotations: { 'com.example': '1' },
      expose: ['9000'],
      tmpfs: ['/run:rw,size=64m'],
      extra_hosts: ['db:10.0.0.2'],
      dns: ['1.1.1.1'],
      dns_search: ['corp'],
      mac_address: '02:42:ac:11:00:02',
      cap_add: ['NET_ADMIN'],
      cap_drop: ['ALL'],
      security_opt: ['no-new-privileges'],
      devices: ['/dev/fuse'],
      sysctls: { 'net.core.somaxconn': '1024' },
      mem_limit: '512m',
      mem_reservation: '256m',
      cpus: 1.5,
      cpu_shares: 512,
      pids_limit: 100,
      oom_score_adj: -500,
      shm_size: '1g',
      pid: 'host',
      ipc: 'shareable',
      userns_mode: 'host',
      cgroup: 'private',
      runtime: 'runsc',
      stop_signal: 'SIGINT',
      stop_grace_period: '30s',
      logging: { driver: 'json-file', options: { 'max-size': '10m' } },
    });
  });

  it('quotes ports and expose entries', () => {
    const { text } = compose('docker run -p 22:22 -p 127.0.0.1:53:53/udp --expose 80 img');
    expect(text).toContain('- "22:22"');
    expect(text).toContain('- "127.0.0.1:53:53/udp"');
    expect(text).toContain('- "80"');
  });

  it('maps health checks', () => {
    expect(
      service(
        "docker run --health-cmd 'curl -f localhost || exit 1' --health-interval 30s --health-timeout 5s --health-retries 3 --health-start-period 10s img",
      ).healthcheck,
    ).toEqual({
      test: ['CMD-SHELL', 'curl -f localhost || exit 1'],
      interval: '30s',
      timeout: '5s',
      retries: 3,
      start_period: '10s',
    });
    expect(service('docker run --no-healthcheck img').healthcheck).toEqual({ disable: true });
  });

  it('declares named volumes but not bind mounts', () => {
    const { yaml, services, notes } = compose(
      'docker run -v pgdata:/var/lib/postgresql/data -v /etc/localtime:/etc/localtime:ro -v ./conf:/conf -v /cache postgres',
    );
    expect(services.postgres!.volumes).toEqual([
      'pgdata:/var/lib/postgresql/data',
      '/etc/localtime:/etc/localtime:ro',
      './conf:/conf',
      '/cache',
    ]);
    expect(yaml.volumes).toEqual({ pgdata: {} });
    expect(notes.join('\n')).toMatch(/external: true/);
  });

  it('turns $(pwd) and $PWD into relative paths', () => {
    expect(service('docker run -v "$(pwd)":/app -v $PWD/data:/data -v ${PWD}/x:/x img').volumes).toEqual([
      '.:/app',
      './data:/data',
      './x:/x',
    ]);
  });

  it('keeps Windows drive paths intact', () => {
    const { yaml } = compose('docker run -v C:\\\\data:/data img');
    expect((yaml.services as Record<string, Obj>).img!.volumes).toEqual(['C:\\data:/data']);
    expect(yaml.volumes).toBeUndefined();
  });

  it('converts --mount to the long syntax', () => {
    const { services, yaml } = compose(
      'docker run --mount type=volume,src=cache,dst=/cache,volume-nocopy --mount type=bind,source=/src,target=/app,readonly,bind-propagation=rshared --mount type=tmpfs,target=/tmp,tmpfs-size=64m img',
    );
    expect(services.img!.volumes).toEqual([
      { type: 'volume', source: 'cache', target: '/cache', volume: { nocopy: true } },
      { type: 'bind', source: '/src', target: '/app', read_only: true, bind: { propagation: 'rshared' } },
      { type: 'tmpfs', target: '/tmp', tmpfs: { size: '64m' } },
    ]);
    expect(yaml.volumes).toEqual({ cache: {} });
  });

  it('maps networks, aliases and network modes', () => {
    const { yaml, services } = compose('docker run --network backend --network-alias db --ip 172.20.0.5 postgres');
    expect(services.postgres!.networks).toEqual({ backend: { aliases: ['db'], ipv4_address: '172.20.0.5' } });
    expect(yaml.networks).toEqual({ backend: { external: true } });
    expect(service('docker run --net=a --network b img').networks).toEqual(['a', 'b']);
    expect(service('docker run --network host img')).toEqual({ image: 'img', network_mode: 'host' });
    expect(service('docker run --network none img').network_mode).toBe('none');
    expect(service('docker run --network default img')).toEqual({ image: 'img' });
    expect(service('docker run --network container:other img').network_mode).toBe('container:other');
  });

  it('resolves references between converted containers', () => {
    const { services, notes } = compose(
      [
        'docker run -d --name vpn qmcgaw/gluetun',
        'docker run -d --network container:vpn --volumes-from vpn:ro qbittorrent',
        'docker run --link vpn:gateway --link outside alpine',
      ].join('\n'),
    );
    expect(services.qbittorrent).toMatchObject({ network_mode: 'service:vpn', volumes_from: ['vpn:ro'] });
    expect(services.alpine).toMatchObject({ links: ['vpn:gateway'], external_links: ['outside'] });
    expect(notes.some((n) => n.includes('--link is deprecated'))).toBe(true);
  });

  it('converts --gpus to device reservations', () => {
    const devices = (s: Obj) => ((s.deploy as Obj).resources as Obj).reservations as Obj;
    expect(devices(service('docker run --gpus all img'))).toEqual({
      devices: [{ driver: 'nvidia', count: 'all', capabilities: ['gpu'] }],
    });
    expect(devices(service('docker run --gpus 2 img')).devices).toEqual([
      { driver: 'nvidia', count: 2, capabilities: ['gpu'] },
    ]);
    expect(devices(service(`docker run --gpus '"device=0,2"' img`)).devices).toEqual([
      { driver: 'nvidia', device_ids: ['0', '2'], capabilities: ['gpu'] },
    ]);
  });

  it('maps ulimits and block I/O limits', () => {
    expect(service('docker run --ulimit nofile=1024:2048 --ulimit nproc=512 img').ulimits).toEqual({
      nofile: { soft: 1024, hard: 2048 },
      nproc: 512,
    });
    expect(
      service('docker run --blkio-weight 300 --device-read-bps /dev/sda:1mb --device-write-iops /dev/sda:100 img')
        .blkio_config,
    ).toEqual({
      weight: 300,
      device_read_bps: [{ path: '/dev/sda', rate: '1mb' }],
      device_write_iops: [{ path: '/dev/sda', rate: 100 }],
    });
  });

  it('handles entrypoints and commands exactly', () => {
    expect(service('docker run --entrypoint /bin/sh img -c "echo a && echo b"')).toEqual({
      image: 'img',
      entrypoint: '/bin/sh',
      command: ['-c', 'echo a && echo b'],
    });
    expect(service('docker run --entrypoint "" img').entrypoint).toEqual([]);
    expect(service('docker run --entrypoint "/opt/my app" img').entrypoint).toEqual(['/opt/my app']);
    expect(service('docker run img -- --flag').command).toEqual(['--', '--flag']);
    expect(service('docker run -- img --flag').command).toEqual(['--flag']);
  });

  it('escapes literal dollars and keeps variables for interpolation', () => {
    const { text } = compose(`docker run -e 'PASSWORD=pa$word' -e USER=$USER -e "HOME=\\$HOME" img`);
    expect(text).toContain('- PASSWORD=pa$$word');
    expect(text).toContain('- USER=$USER');
    expect(text).toContain('- HOME=$$HOME');
  });

  it('quotes YAML values that would change type', () => {
    const { text } = compose('docker run --restart no -e ON=on -l yes img');
    expect(text).toContain('restart: "no"');
    expect(parse(text).services.img.restart).toBe('no');
  });

  it('converts several commands with unique service names', () => {
    const { services, notes } = compose(
      'docker network create app && docker run -d redis:7 && docker run -d redis:7; docker run --name Web_1 nginx',
    );
    expect(Object.keys(services)).toEqual(['redis', 'redis-2', 'web_1']);
    expect(services.web_1!.container_name).toBe('Web_1');
    expect(notes[0]).toMatch(/Skipped "docker network create app": only docker run/);
  });

  it('warns about unknown flags and flags without an equivalent', () => {
    const { notes, services } = compose(
      'docker run --frobnicate -P --cidfile /tmp/id -a stdout --kernel-memory 1g img',
    );
    expect(services.img).toEqual({ image: 'img' });
    expect(notes.join('\n')).toMatch(/Unknown option --frobnicate/);
    expect(notes.join('\n')).toMatch(/-P .*list them under ports/);
    expect(notes.join('\n')).toMatch(/--cidfile has no Compose equivalent/);
    expect(notes.join('\n')).toMatch(/-a has no Compose equivalent/);
  });

  it('notes --rm, a missing value and a missing image', () => {
    expect(
      runToCompose('docker run --rm img')
        .notes.map((n) => n.message)
        .join(),
    ).toMatch(/--rm/);
    expect(
      runToCompose('docker run --name')
        .notes.map((n) => n.message)
        .join(),
    ).toMatch(/--name needs a value/);
    expect(
      runToCompose('docker run -d')
        .notes.map((n) => n.message)
        .join(),
    ).toMatch(/has no image/);
  });

  it('derives service names from images', () => {
    expect(imageName('ghcr.io/org/app:1.2@sha256:abc')).toBe('app');
    expect(imageName('localhost:5000/web')).toBe('web');
    expect(Object.keys(compose('docker run $IMAGE').services)).toEqual(['image']);
    expect(Object.keys(compose('docker run --name "!!" img').services)).toEqual(['app']);
  });

  it('rejects input without docker run', () => {
    expect(() => dockerComposeConverter('ls -la')).toThrow(/No docker run command found/);
    expect(() => dockerComposeConverter('docker ps')).toThrow(ToolInputError);
  });

  it('returns nothing for empty input', () => {
    expect(dockerComposeConverter('  \n')).toEqual({ text: '', notes: [] });
    expect(dockerComposeConverter('', 'compose-to-run')).toEqual({ text: '', notes: [] });
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => dockerComposeConverter(s), {
      malformed: ['docker run "unterminated', 'docker run -', 'docker run --', `docker run ${'-'.repeat(10000)}`],
    });
    expectRobust((s) => dockerComposeConverter(s, 'compose-to-run'), {
      malformed: [
        'services: [',
        'services: 3',
        'a: &a [*a]',
        'services:\n  web: 1',
        '- a\n- b',
        'services:\n  x:\n    ports: {a: 1}\n    volumes: 3\n    networks: 5',
      ],
    });
  });
});

describe('Compose → docker run', () => {
  const run = (yaml: string) => composeToRun(yaml);

  it('converts a typical service', () => {
    const { script } = run(
      'services:\n  web:\n    image: nginx:1.27\n    ports:\n      - "8080:80"\n    restart: unless-stopped\n',
    );
    expect(script).toBe('docker run -d --name web \\\n  -p 8080:80 \\\n  --restart unless-stopped \\\n  nginx:1.27');
  });

  it('quotes values safely', () => {
    const { script } = run(
      [
        'services:',
        '  app:',
        '    image: app',
        '    environment:',
        '      GREETING: "it\'s a test"',
        '      SECRET: pa$$word',
        '      HOME_DIR: $HOME/app',
        '      EMPTY:',
        '      NUM: 3',
        '    labels:',
        '      - "a=b c"',
        '    command: ["sh", "-c", "echo $$PATH; ls *"]',
      ].join('\n'),
    );
    expect(script).toContain(`-e 'GREETING=it'\\''s a test'`);
    expect(script).toContain(`-e 'SECRET=pa$word'`);
    expect(script).toContain('-e "HOME_DIR=$HOME/app"');
    expect(script).toContain('-e EMPTY \\');
    expect(script).toContain('-e NUM=3');
    expect(script).toContain(`-l 'a=b c'`);
    expect(script).toContain(`app sh -c 'echo $PATH; ls *'`);
  });

  it('splits string commands and entrypoints like Compose', () => {
    const { script } = run(
      'services:\n  a:\n    image: img\n    entrypoint: /bin/sh -c\n    command: \'echo "a b"\'\n',
    );
    expect(script).toContain('--entrypoint /bin/sh');
    expect(script).toMatch(/img -c echo 'a b'$/);
    expect(run('services:\n  a:\n    image: img\n    entrypoint: []\n').script).toContain("--entrypoint ''");
  });

  it('rewrites relative host paths and resolves volume names', () => {
    const { script } = run(
      [
        'services:',
        '  db:',
        '    image: postgres',
        '    volumes:',
        '      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro',
        '      - .:/src',
        '      - ~/.ssh:/root/.ssh',
        '      - data:/var/lib/postgresql/data',
        '      - type: bind',
        '        source: ./conf',
        '        target: /conf',
        '        read_only: true',
        'volumes:',
        '  data:',
        '    name: pg-data',
      ].join('\n'),
    );
    expect(script).toContain('-v "$(pwd)"/init.sql:/docker-entrypoint-initdb.d/init.sql:ro');
    expect(script).toContain('-v "$(pwd)":/src');
    expect(script).toContain('-v ~/.ssh:/root/.ssh');
    expect(script).toContain('-v pg-data:/var/lib/postgresql/data');
    expect(script).toContain('--mount type=bind,source="$(pwd)"/conf,target=/conf,readonly');
  });

  it('converts long-syntax ports', () => {
    const { script } = run(
      'services:\n  a:\n    image: img\n    ports:\n      - target: 80\n        published: 8080\n        host_ip: 127.0.0.1\n      - target: 53\n        protocol: udp\n      - 9000\n',
    );
    expect(script).toContain('-p 127.0.0.1:8080:80');
    expect(script).toContain('-p 53/udp');
    expect(script).toContain('-p 9000');
  });

  it('creates networks, orders by depends_on and warns about the rest', () => {
    const { script, notes } = run(
      [
        'version: "3.8"',
        'services:',
        '  web:',
        '    build: ./web',
        '    depends_on: [db]',
        '    profiles: [prod]',
        '    networks: [front, back]',
        '  db:',
        '    image: postgres:16',
        '    networks:',
        '      back:',
        '        aliases: [database]',
        'networks:',
        '  front:',
        '    driver: bridge',
        '  back:',
        '    external: true',
        '    name: shared-back',
      ].join('\n'),
    );
    const lines = script.split('\n');
    expect(lines[0]).toBe('docker network create --driver bridge front');
    expect(script).toContain('docker build -t web ./web');
    expect(script.indexOf('# db')).toBeLessThan(script.indexOf('# web'));
    expect(script).toContain('--network shared-back \\\n  --network-alias database');
    expect(script).not.toContain('docker network create shared-back');
    const text = notes.map((n) => n.message).join('\n');
    expect(text).toMatch(/"version" key is obsolete/);
    expect(text).toMatch(/web: "profiles" has no docker run equivalent/);
    expect(text).toMatch(/web: "depends_on"/);
    expect(text).toMatch(/Docker 25/);
  });

  it('maps resources, health checks, secrets and more', () => {
    const { script, notes } = run(
      [
        'services:',
        '  api:',
        '    image: api',
        '    container_name: my-api',
        '    stdin_open: true',
        '    tty: true',
        '    healthcheck:',
        '      test: ["CMD", "curl", "-f", "http-check"]',
        '      interval: 1m',
        '      retries: 3',
        '    stop_grace_period: 1m30s',
        '    deploy:',
        '      replicas: 2',
        '      resources:',
        '        limits: { cpus: "0.5", memory: 256M }',
        '        reservations:',
        '          devices:',
        '            - capabilities: [gpu]',
        '              count: all',
        '      restart_policy: { condition: on-failure, max_attempts: 3 }',
        '    ulimits:',
        '      nofile: { soft: 1024, hard: 4096 }',
        '    logging:',
        '      driver: json-file',
        '      options: { max-size: 10m }',
        '    secrets: [db_pass]',
        '    extra_hosts:',
        '      host.docker.internal: host-gateway',
        '    x-custom: 1',
        '  worker:',
        '    image: api',
        '    network_mode: service:api',
        '    volumes_from: [api]',
        'secrets:',
        '  db_pass:',
        '    file: ./secrets/db_pass.txt',
      ].join('\n'),
    );
    expect(script).toContain('docker run -d --name my-api \\\n  -it');
    expect(script).toContain("--health-cmd 'curl -f http-check'");
    expect(script).toContain('--health-interval 1m');
    expect(script).toContain('--stop-timeout 90');
    expect(script).toContain('--cpus 0.5');
    expect(script).toContain('--memory 256M');
    expect(script).toContain('--gpus all');
    expect(script).toContain('--restart on-failure:3');
    expect(script).toContain('--ulimit nofile=1024:4096');
    expect(script).toContain('--log-opt max-size=10m');
    expect(script).toContain('-v "$(pwd)"/secrets/db_pass.txt:/run/secrets/db_pass:ro');
    expect(script).toContain('--add-host host.docker.internal:host-gateway');
    expect(script).toContain('--network container:my-api');
    expect(script).toContain('--volumes-from my-api');
    expect(notes.map((n) => n.message).join('\n')).toMatch(/replicas/);
    expect(script).not.toContain('custom');
  });

  it('reads version 1 files', () => {
    const { script, notes } = run('web:\n  image: nginx\n');
    expect(script).toBe('docker run -d --name web \\\n  nginx');
    expect(notes[0]!.message).toMatch(/version 1/);
  });

  it('rejects invalid documents', () => {
    expect(() => run('services: [')).toThrow(/Invalid YAML/);
    expect(() => run('- a')).toThrow(/mapping/);
    expect(() => run('foo: bar')).toThrow(/No "services:" found/);
    expect(() => run('services: 3')).toThrow(ToolInputError);
    expect(() => run('services:\n  a: 1\n  a: 2')).toThrow(/Invalid YAML/);
  });

  it('parses Go durations', () => {
    expect(durationSeconds('1m30s')).toBe(90);
    expect(durationSeconds('1h')).toBe(3600);
    expect(durationSeconds('500ms')).toBe(1);
    expect(durationSeconds('10')).toBe(10);
    expect(durationSeconds('soon')).toBeUndefined();
  });
});

describe('round trips', () => {
  it('Compose → docker run → Compose keeps the service', () => {
    const original = {
      services: {
        web: {
          image: 'nginx:1.27',
          container_name: 'web',
          restart: 'always',
          working_dir: '/usr/share/nginx/html',
          command: ['nginx', '-g', 'daemon off;'],
          environment: ['TZ=Europe/Paris', 'MSG=hello world', 'PW=a$$b', 'HOME_DIR=${HOME}'],
          ports: ['8080:80', '127.0.0.1:8443:443'],
          volumes: ['./site:/usr/share/nginx/html:ro', 'logs:/var/log/nginx'],
          networks: ['front'],
          cap_add: ['NET_ADMIN'],
          healthcheck: { test: ['CMD-SHELL', 'curl -f localhost || exit 1'], interval: '30s', retries: 3 },
          ulimits: { nofile: { soft: 1024, hard: 2048 } },
          logging: { driver: 'json-file', options: { 'max-size': '10m' } },
          sysctls: { 'net.ipv4.ip_unprivileged_port_start': '0' },
        },
      },
    };
    const yaml = JSON.stringify(original);
    const script = dockerComposeConverter(yaml, 'compose-to-run').text;
    const back = parse(dockerComposeConverter(script).text) as typeof original & Obj;
    expect(back.services.web).toEqual(original.services.web);
    expect(back.networks).toEqual({ front: { external: true } });
    expect(back.volumes).toEqual({ logs: {} });
  });

  it('docker run → Compose → docker run is stable', () => {
    const input = [
      `docker run -d --name cache -p 6379:6379 -v redis:/data --restart always redis:7 redis-server --save ''`,
      `docker run -d --name app -e 'GREETING=hi there' -e PW='x$y' --network-alias api --network back --entrypoint /entry.sh myorg/app:1 --verbose`,
    ].join('\n');
    const once = dockerComposeConverter(dockerComposeConverter(input).text, 'compose-to-run').text;
    const twice = dockerComposeConverter(dockerComposeConverter(once).text, 'compose-to-run').text;
    expect(twice).toBe(once);
    expect(once).toContain(`redis:7 redis-server --save ''`);
    expect(once).toContain(`-e 'PW=x$y'`);
    expect(once).toContain(`-e 'GREETING=hi there'`);
    // Parsing the script back gives the same arguments as the original command.
    const first = splitCommands(input)[1]!.words;
    const again = splitCommands(once).find((c) => c.words.includes('app'))!.words;
    expect(again).toEqual(expect.arrayContaining(first.slice(2)));
  });
});
