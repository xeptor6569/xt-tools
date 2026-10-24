import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import {
  buildCompose,
  createDefaultConfig,
  createService,
  parseComposeYaml,
  parsePorts,
  parseVolumes,
  type ComposeConfig,
  type DependsCondition,
  type ServiceConfig,
} from './logic.ts';
import meta from './meta.ts';

type Obj = Record<string, unknown>;

function defaultWithImage(image = 'nginx:1.27'): ComposeConfig {
  const config = createDefaultConfig();
  config.services[0]!.image = image;
  return config;
}

function imageService(id: string, name: string, image = 'example/image:1'): ServiceConfig {
  return { ...createService(id, name), image };
}

function yaml(text: string): Obj {
  return parse(text) as Obj;
}

function services(text: string): Record<string, Obj> {
  return yaml(text).services as Record<string, Obj>;
}

function expectInputError(fn: () => unknown, message?: RegExp): void {
  expect(fn).toThrow(ToolInputError);
  if (message) expect(fn).toThrow(message);
}

describe('compose generation', () => {
  it('starts with one empty web service', () => {
    const config = createDefaultConfig();
    expect(config.services).toHaveLength(1);
    expect(config.services[0]).toMatchObject({ name: 'web', image: '', buildContext: '', extra: '' });
    expect(config.volumes).toEqual([]);
    expect(config.networks).toEqual([]);
  });

  it('generates the minimal default output without an obsolete version key', () => {
    const result = buildCompose(defaultWithImage());
    expect(result.text).toBe('services:\n  web:\n    image: nginx:1.27\n');
    expect(result.warnings).toEqual([]);
    expect(result.text).not.toContain('version:');
  });

  it('requires an image or build in the otherwise empty default service', () => {
    expectInputError(() => buildCompose(createDefaultConfig()), /Set an image or a build context\/dockerfile/);
  });

  it('makes the metadata example work from the default config', () => {
    const example = meta.examples![0]!;
    const config = createDefaultConfig();
    config.services[0]!.image = example.input;
    expect(buildCompose(config).text).toContain(example.expect);
  });

  it('generates a full service with stable, quoted YAML', () => {
    const config = createDefaultConfig();
    config.name = 'demo';
    const web: ServiceConfig = {
      ...createService('service-1', 'web'),
      image: 'example/web:1.0',
      buildContext: './web',
      buildDockerfile: 'Dockerfile.prod',
      containerName: 'demo-web',
      restart: 'unless-stopped',
      ports: '8080:80\n127.0.0.1:5353:53/udp',
      expose: '9000',
      volumes: './data:/data\nwebdata:/var/lib/web:ro',
      environment: [
        { id: 'env-1', key: 'MODE', value: 'no' },
        { id: 'env-2', key: 'EMPTY', value: '' },
      ],
      envFile: '.env\n./web.env',
      command: 'serve --port 80',
      entrypoint: '/docker-entrypoint.sh',
      workingDir: '/srv',
      user: '1000:1000',
      hostname: 'web.internal',
      dependsOn: [{ id: 'depends-1', service: 'db', condition: 'service_healthy' }],
      networks: ['backend'],
      extra: 'privileged: true',
    };
    config.services = [web, imageService('service-2', 'db', 'postgres:17')];
    config.volumes = [{ id: 'volume-1', name: 'webdata', external: false }];
    config.networks = [{ id: 'network-1', name: 'backend', external: false, driver: '' }];

    expect(buildCompose(config).text).toBe(`name: demo
services:
  web:
    image: example/web:1.0
    build:
      context: ./web
      dockerfile: Dockerfile.prod
    container_name: demo-web
    restart: unless-stopped
    ports:
      - "8080:80"
      - "127.0.0.1:5353:53/udp"
    expose:
      - "9000"
    volumes:
      - ./data:/data
      - webdata:/var/lib/web:ro
    environment:
      MODE: "no"
      EMPTY: ""
    env_file:
      - .env
      - ./web.env
    command: serve --port 80
    entrypoint: /docker-entrypoint.sh
    working_dir: /srv
    user: 1000:1000
    hostname: web.internal
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend
    privileged: true
  db:
    image: postgres:17
volumes:
  webdata: {}
networks:
  backend: {}
`);
  });

  it('uses the short depends_on list when every condition is service_started', () => {
    const config = createDefaultConfig();
    const web = imageService('service-1', 'web');
    web.dependsOn = [
      { id: 'depends-1', service: 'db', condition: 'service_started' },
      { id: 'depends-2', service: 'worker', condition: 'service_started' },
    ];
    config.services = [web, imageService('service-2', 'db'), imageService('service-3', 'worker')];
    const text = buildCompose(config).text;
    expect(services(text).web!.depends_on).toEqual(['db', 'worker']);
    expect(text).not.toContain('condition:');
  });

  it('supports dockerfile-only builds and image plus build', () => {
    const config = defaultWithImage();
    config.services[0]!.buildDockerfile = 'Containerfile';
    const build = services(buildCompose(config).text).web!.build as Obj;
    expect(build).toEqual({ context: '.', dockerfile: 'Containerfile' });
    expect(services(buildCompose(config).text).web!.image).toBe('nginx:1.27');
  });

  it('auto-declares named volumes and networks, but not bind or anonymous mounts', () => {
    const config = defaultWithImage();
    config.services[0]!.volumes = [
      'dbdata:/var/lib/db',
      'cache:/cache:ro',
      './local:/local',
      '/absolute:/absolute',
      '~/home:/home',
      'C:\\data:/windows',
      '/anonymous',
    ].join('\n');
    config.services[0]!.networks = ['frontend', 'backend'];
    const result = buildCompose(config);
    const root = yaml(result.text);
    expect(root.volumes).toEqual({ cache: {}, dbdata: {} });
    expect(root.networks).toEqual({ backend: {}, frontend: {} });
    expect(result.warnings).toEqual([
      'Auto-declared named volumes: cache, dbdata.',
      'Auto-declared networks: backend, frontend.',
    ]);
  });

  it('does not auto-declare special network modes and warns when they are selected', () => {
    const config = defaultWithImage();
    config.services[0]!.networks = ['default', 'host', 'none'];
    const result = buildCompose(config);
    expect(yaml(result.text).networks).toBeUndefined();
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.join('\n')).toMatch(/network_mode/);
    expect(result.warnings.join('\n')).toMatch(/default/);
  });

  it('keeps declared volume and network external and driver settings', () => {
    const config = defaultWithImage();
    config.volumes = [
      { id: 'volume-1', name: 'existing', external: true },
      { id: 'volume-2', name: 'created', external: false },
    ];
    config.networks = [
      { id: 'network-1', name: 'internal', external: false, driver: 'bridge' },
      { id: 'network-2', name: 'outside', external: true, driver: '' },
    ];
    const root = yaml(buildCompose(config).text);
    expect(root.volumes).toEqual({ existing: { external: true }, created: {} });
    expect(root.networks).toEqual({ internal: { driver: 'bridge' }, outside: { external: true } });
  });

  it('adds extra service and top-level mappings in the required root order', () => {
    const config = defaultWithImage();
    config.name = 'ordered';
    config.services[0]!.extra = 'privileged: true\ndeploy:\n  replicas: 2';
    config.services[0]!.volumes = 'data:/data';
    config.services[0]!.networks = ['appnet'];
    config.extra = 'secrets:\n  token:\n    file: ./token';
    const text = buildCompose(config).text;
    const root = yaml(text);
    expect(services(text).web).toMatchObject({ privileged: true, deploy: { replicas: 2 } });
    expect(root.secrets).toEqual({ token: { file: './token' } });
    expect(text.indexOf('name:')).toBeLessThan(text.indexOf('services:'));
    expect(text.indexOf('services:')).toBeLessThan(text.indexOf('volumes:'));
    expect(text.indexOf('volumes:')).toBeLessThan(text.indexOf('networks:'));
    expect(text.indexOf('networks:')).toBeLessThan(text.indexOf('secrets:'));
  });

  it('quotes YAML 1.1 ambiguous values and always quotes ports and expose', () => {
    const config = defaultWithImage('on');
    config.services[0]!.restart = 'no';
    config.services[0]!.ports = '22:22';
    config.services[0]!.expose = '53';
    config.services[0]!.environment = [{ id: 'env-1', key: 'ENABLED', value: 'on' }];
    const text = buildCompose(config).text;
    expect(text).toContain('image: "on"');
    expect(text).toContain('restart: "no"');
    expect(text).toContain('ENABLED: "on"');
    expect(text).toContain('- "22:22"');
    expect(text).toContain('- "53"');
  });
});

describe('form validation and text parsers', () => {
  it('accepts the documented port forms and ranges', () => {
    expect(parsePorts('80\n8080:80\n127.0.0.1:8080:80\n53:53/udp\n[::1]:8080:80\n8000-8002:80-82')).toEqual([
      '80',
      '8080:80',
      '127.0.0.1:8080:80',
      '53:53/udp',
      '[::1]:8080:80',
      '8000-8002:80-82',
    ]);
  });

  it.each(['abc', '8080:', ':80', '1:2:3:4', '0', '65536', '80/bad', '80:90:80:70'])(
    'rejects invalid port syntax %j',
    (value) => {
      expectInputError(() => parsePorts(value), /Invalid port/);
    },
  );

  it('accepts named, bind, Windows and anonymous volumes', () => {
    const lines = ['./data:/data', '/host:/data', '~/data:/data', 'C:\\data:/data:ro', 'dbdata:/db', '/anonymous'];
    expect(parseVolumes(lines.join('\n'))).toEqual(lines);
    expect(parseVolumes('/cache:ro')).toEqual(['/cache:ro']);
  });

  it.each(['relative', 'name:', ':/data', 'name:relative', 'name:/data:ro:extra', 'name:/data:', 'name:/data:ro@'])(
    'rejects invalid volume syntax %j',
    (value) => {
      expectInputError(() => parseVolumes(value), /Invalid volume/);
    },
  );

  it('requires at least one service', () => {
    const config = defaultWithImage();
    config.services = [];
    expectInputError(() => buildCompose(config), /At least one service/);
  });

  it.each(['', '  ', '-web', '_web', '.web', 'two words', 'web/api', 'wéb'])(
    'rejects invalid service name %j',
    (name) => {
      const config = defaultWithImage();
      config.services[0]!.name = name;
      expectInputError(() => buildCompose(config), /service name|empty name/i);
    },
  );

  it('rejects duplicate service names', () => {
    const config = defaultWithImage();
    config.services = [imageService('service-1', 'web'), imageService('service-2', 'web')];
    expectInputError(() => buildCompose(config), /Duplicate service name "web"/);
  });

  it('rejects empty and duplicate environment keys', () => {
    const empty = defaultWithImage();
    empty.services[0]!.environment = [{ id: 'env-1', key: '', value: 'x' }];
    expectInputError(() => buildCompose(empty), /cannot be empty/);
    const duplicate = defaultWithImage();
    duplicate.services[0]!.environment = [
      { id: 'env-1', key: 'TOKEN', value: 'a' },
      { id: 'env-2', key: 'TOKEN', value: 'b' },
    ];
    expectInputError(() => buildCompose(duplicate), /Duplicate environment variable "TOKEN"/);
  });

  it('rejects unknown and self dependencies', () => {
    const unknown = defaultWithImage();
    unknown.services[0]!.dependsOn = [{ id: 'depends-1', service: 'missing', condition: 'service_started' }];
    expectInputError(() => buildCompose(unknown), /unknown service "missing"/);
    const self = defaultWithImage();
    self.services[0]!.dependsOn = [{ id: 'depends-1', service: 'web', condition: 'service_started' }];
    expectInputError(() => buildCompose(self), /cannot depend on itself/);
  });

  it('rejects duplicate dependencies and invalid conditions', () => {
    const config = createDefaultConfig();
    config.services = [
      {
        ...imageService('service-1', 'web'),
        dependsOn: [
          { id: 'depends-1', service: 'db', condition: 'service_started' },
          { id: 'depends-2', service: 'db', condition: 'service_healthy' },
        ],
      },
      imageService('service-2', 'db'),
    ];
    expectInputError(() => buildCompose(config), /Duplicate depends_on row/);
    config.services[0]!.dependsOn = [{ id: 'depends-1', service: 'db', condition: 'sometimes' as DependsCondition }];
    expectInputError(() => buildCompose(config), /Invalid depends_on condition/);
  });

  it('rejects malformed, non-mapping and colliding service extra YAML', () => {
    for (const extra of ['privileged: [', '- privileged', 'true']) {
      const config = defaultWithImage();
      config.services[0]!.extra = extra;
      expectInputError(() => buildCompose(config), /Additional service YAML|Invalid YAML/);
    }
    const collision = defaultWithImage();
    collision.services[0]!.extra = 'image: other';
    expectInputError(() => buildCompose(collision), /managed key "image"/);
  });

  it('rejects malformed, non-mapping and colliding top-level extra YAML', () => {
    for (const extra of ['secrets: [', '- secrets', 'true']) {
      const config = defaultWithImage();
      config.extra = extra;
      expectInputError(() => buildCompose(config));
    }
    for (const extra of ['services: {}', 'version: "3.9"']) {
      const config = defaultWithImage();
      config.extra = extra;
      expectInputError(() => buildCompose(config));
    }
  });

  it('rejects duplicate declared resources', () => {
    const volumes = defaultWithImage();
    volumes.volumes = [
      { id: 'volume-1', name: 'data', external: false },
      { id: 'volume-2', name: 'data', external: true },
    ];
    expectInputError(() => buildCompose(volumes), /Duplicate declared volume/);
    const networks = defaultWithImage();
    networks.networks = [
      { id: 'network-1', name: 'app', external: false, driver: '' },
      { id: 'network-2', name: 'app', external: false, driver: '' },
    ];
    expectInputError(() => buildCompose(networks), /Duplicate declared network/);
  });

  it('checks YAML and line parsers with empty, huge and malformed input', () => {
    expectRobust(parseComposeYaml, {
      malformed: ['services: [', '---\nservices: {}\n---\nservices: {}', '['.repeat(100_000)],
    });
    expectRobust(parsePorts, { malformed: ['1:2:3:4', ':'.repeat(100_000), '80/no'] });
    expectRobust(parseVolumes, { malformed: ['name:', ':'.repeat(100_000), '/x\0/y'] });
  });
});

describe('Compose YAML import', () => {
  it('imports environment mappings with scalar values', () => {
    const config = parseComposeYaml(`services:
  web:
    image: nginx
    environment:
      TEXT: hello
      NUMBER: 42
      FLAG: false
      EMPTY: ""
      PASSTHROUGH: null
`);
    expect(config.services[0]!.environment.map(({ key, value }) => [key, value])).toEqual([
      ['TEXT', 'hello'],
      ['NUMBER', '42'],
      ['FLAG', 'false'],
      ['EMPTY', ''],
      ['PASSTHROUGH', ''],
    ]);
    expect(services(buildCompose(config).text).web!.environment).toEqual({
      TEXT: 'hello',
      NUMBER: '42',
      FLAG: 'false',
      EMPTY: '',
      PASSTHROUGH: '',
    });
  });

  it('imports environment lists including empty and pass-through values', () => {
    const config = parseComposeYaml(`services:
  web:
    image: nginx
    environment:
      - FOO=bar=baz
      - EMPTY=
      - PASSTHROUGH
`);
    expect(config.services[0]!.environment.map(({ key, value }) => [key, value])).toEqual([
      ['FOO', 'bar=baz'],
      ['EMPTY', ''],
      ['PASSTHROUGH', ''],
    ]);
  });

  it('imports list and long-mapping depends_on forms', () => {
    const list = parseComposeYaml(`services:
  web:
    image: nginx
    depends_on: [db]
  db:
    image: postgres
`);
    expect(list.services[0]!.dependsOn).toMatchObject([{ service: 'db', condition: 'service_started' }]);

    const mapping = parseComposeYaml(`services:
  web:
    image: nginx
    depends_on:
      db:
        condition: service_healthy
        required: true
      worker:
        condition: service_completed_successfully
  db:
    image: postgres
  worker:
    image: worker
`);
    expect(mapping.services[0]!.dependsOn).toMatchObject([
      { service: 'db', condition: 'service_healthy' },
      { service: 'worker', condition: 'service_completed_successfully' },
    ]);
    const output = services(buildCompose(mapping).text).web!.depends_on as Obj;
    expect(output).toEqual({
      db: { condition: 'service_healthy', required: true },
      worker: { condition: 'service_completed_successfully' },
    });
  });

  it('shell-joins command and entrypoint lists with best-effort quoting', () => {
    const config = parseComposeYaml(`services:
  web:
    image: nginx
    command: ["serve", "--name", "hello world", "it's"]
    entrypoint: ["/bin/sh", "-c"]
`);
    expect(config.services[0]!.command).toBe("serve --name 'hello world' 'it'\\''s'");
    expect(config.services[0]!.entrypoint).toBe('/bin/sh -c');
    const output = services(buildCompose(config).text).web!;
    expect(output.command).toBe("serve --name 'hello world' 'it'\\''s'");
    expect(output.entrypoint).toBe('/bin/sh -c');
  });

  it('imports top-level null, empty, external and driver declarations', () => {
    const config = parseComposeYaml(`services:
  web:
    image: nginx
volumes:
  empty:
  existing:
    external: true
networks:
  plain: {}
  app:
    external: true
    driver: bridge
`);
    expect(config.volumes).toMatchObject([
      { name: 'empty', external: false },
      { name: 'existing', external: true },
    ]);
    expect(config.networks).toMatchObject([
      { name: 'plain', external: false, driver: '' },
      { name: 'app', external: true, driver: 'bridge' },
    ]);
  });

  it('preserves unrecognized service and top-level keys in generated output', () => {
    const imported = parseComposeYaml(`x-tenant: demo
services:
  web:
    image: nginx
    privileged: true
    healthcheck:
      test: ["CMD", "true"]
    x-service-note: keep
secrets:
  token:
    file: ./token
`);
    const text = buildCompose(imported).text;
    const root = yaml(text);
    expect(root['x-tenant']).toBe('demo');
    expect(root.secrets).toEqual({ token: { file: './token' } });
    expect(services(text).web).toMatchObject({
      privileged: true,
      healthcheck: { test: ['CMD', 'true'] },
      'x-service-note': 'keep',
    });
  });

  it.each([
    '',
    '  \n',
    '[]',
    'hello',
    'services: []',
    'services: {}',
    'services:\n  web: []',
    'services: [',
    'services:\n  web:\n    image: nginx\n---\nservices:\n  other:\n    image: nginx',
    'services:\n  web:\n    image: nginx\nvolumes: []',
    'services:\n  web:\n    image: nginx\nnetworks: nope',
    'services:\n  web:\n    image: nginx\n    environment: nope',
    'services:\n  web:\n    image: nginx\n    depends_on: nope',
    'services:\n  web:\n    image: nginx\n    build: []',
  ])('rejects malformed import %#', (input) => {
    expectInputError(() => parseComposeYaml(input));
  });

  it('round-trips recognized and advanced Compose structures', () => {
    const source = `name: demo
x-workspace: local
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: example
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
  web:
    image: example/web:1
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
      - FEATURE_FLAG
    depends_on:
      db:
        condition: service_healthy
        required: true
    networks:
      frontend:
        aliases: [web]
    deploy:
      replicas: 2
volumes:
  dbdata:
    external: true
    driver_opts:
      type: none
networks:
  frontend:
    driver: bridge
    internal: true
secrets:
  token:
    file: ./token
`;
    const first = parseComposeYaml(source);
    const firstText = buildCompose(first).text;
    const second = parseComposeYaml(firstText);
    const secondText = buildCompose(second).text;

    expect(second.services.map((service) => service.name)).toEqual(['db', 'web']);
    expect(second.services[1]).toMatchObject({
      image: 'example/web:1',
      buildContext: './web',
      buildDockerfile: 'Dockerfile',
      networks: ['frontend'],
    });
    expect(second.services[1]!.dependsOn).toMatchObject([{ service: 'db', condition: 'service_healthy' }]);
    expect(second.volumes[0]).toMatchObject({ name: 'dbdata', external: true });
    expect(second.networks[0]).toMatchObject({ name: 'frontend', external: false, driver: 'bridge' });
    expect(secondText).toBe(firstText);
    for (const preserved of [
      'x-workspace: local',
      'healthcheck:',
      'deploy:',
      'args:',
      'required: true',
      'aliases:',
      'driver_opts:',
      'internal: true',
      'secrets:',
    ]) {
      expect(secondText).toContain(preserved);
    }
  });
});
