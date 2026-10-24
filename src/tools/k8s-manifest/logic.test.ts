import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { DATA_FILE } from './dataset.ts';
import { decodeLocation, formatPath, imageTagProblem, summarize, validateManifests, type K8sSchemas } from './logic.ts';
import meta from './meta.ts';
import { TEMPLATES } from './templates.ts';

const data = JSON.parse(readFileSync(join(import.meta.dirname, '../../../public', DATA_FILE), 'utf8')) as K8sSchemas;
const run = (text: string, bestPractices = true) => validateManifests(text, data, { bestPractices });
const errors = (text: string) => run(text).issues.filter((i) => i.severity === 'error');

const pod = (containers: string) => `apiVersion: v1
kind: Pod
metadata:
  name: p
spec:
${containers}`;

const service = (targetPort: string) => `apiVersion: v1
kind: Service
metadata:
  name: s
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: ${targetPort}
`;

describe('bundled dataset', () => {
  it('has the curated kinds and resolvable refs', () => {
    expect(data.version).toMatch(/^v1\.\d+\.\d+$/);
    expect(data.kinds).toHaveLength(28);
    for (const k of data.kinds) expect(data.definitions[k.ref], k.ref).toBeDefined();
    const refs = JSON.stringify(data.definitions).match(/"\$ref":"#\/definitions\/[^"]+"/g) ?? [];
    for (const r of refs) expect(data.definitions[r.slice(22, -1)], r).toBeDefined();
    expect(data.kinds.find((k) => k.kind === 'HorizontalPodAutoscaler')?.apiVersion).toBe('autoscaling/v2');
  });
});

describe('validateManifests', () => {
  it.each(TEMPLATES.map((t) => [t.label, t.yaml]))('template %s is valid with no warnings', (_label, yaml) => {
    const report = run(yaml);
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(1);
  });

  it('runs the meta example', () => {
    for (const ex of meta.examples ?? []) expect(summarize(run(ex.input))).toContain(ex.expect);
  });

  it('catches a misspelled field as unknown, with a suggestion and line number', () => {
    const text = pod('  contianers:\n    - name: a\n      image: nginx:1.27\n');
    const errs = errors(text);
    expect(errs).toContainEqual({
      document: 1,
      severity: 'error',
      path: 'spec.contianers',
      message: 'Unknown field "contianers". Did you mean "containers"?',
      line: 6,
    });
    expect(errs).toContainEqual(expect.objectContaining({ message: 'Missing required field "containers".', line: 6 }));
    expect(errs).toHaveLength(2);
  });

  it('catches a missing required field', () => {
    const text = pod('  restartPolicy: Always\n');
    expect(errors(text)).toEqual([
      { document: 1, severity: 'error', path: 'spec', message: 'Missing required field "containers".', line: 6 },
    ]);
  });

  it('catches wrong types without spurious unknown-field errors', () => {
    const text = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: d
spec:
  replicas: three
  selector:
    matchLabels: {app: d}
  template:
    metadata:
      labels: {app: d}
    spec:
      containers:
        - name: a
          image: nginx:1.27
          ports:
            - containerPort: "80"
`;
    expect(errors(text)).toEqual([
      { document: 1, severity: 'error', path: 'spec.replicas', message: 'Expected integer, got string.', line: 6 },
      {
        document: 1,
        severity: 'error',
        path: 'spec.template.spec.containers[0].ports[0].containerPort',
        message: 'Expected integer, got string.',
        line: 17,
      },
    ]);
  });

  it('accepts int-or-string ports as names or numbers', () => {
    expect(errors(service('http'))).toEqual([]);
    expect(errors(service('8080'))).toEqual([]);
    expect(errors(service('true'))).toEqual([
      expect.objectContaining({
        path: 'spec.ports[0].targetPort',
        message: 'Expected string or integer, got boolean.',
      }),
    ]);
  });

  it('accepts quantities as strings or numbers', () => {
    const text = pod(
      '  containers:\n    - name: a\n      image: a:1\n      resources:\n        limits: {cpu: 1, memory: 1Gi}\n',
    );
    expect(errors(text)).toEqual([]);
  });

  it('checks map values (labels must be strings)', () => {
    const text = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: c\n  labels:\n    a: 1\n';
    expect(errors(text)).toEqual([expect.objectContaining({ path: 'metadata.labels.a', line: 6 })]);
  });

  it('ignores nulls like kubectl output does', () => {
    const text = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: c\n  creationTimestamp: null\ndata: {}\n';
    expect(run(text).issues).toEqual([]);
  });

  it('reports document indices and lines across multiple documents', () => {
    const text = `${TEMPLATES[1]?.yaml}---\n${pod('  containers: 5\n')}---\n---\n${TEMPLATES[3]?.yaml}`;
    const report = run(text, false);
    expect(report.documents.map((d) => [d.document, d.kind, d.status])).toEqual([
      [1, 'Service', 'valid'],
      [2, 'Pod', 'invalid'],
      [3, 'ConfigMap', 'valid'],
    ]);
    expect(report.issues).toEqual([
      { document: 2, severity: 'error', path: 'spec.containers', message: 'Expected array, got number.', line: 20 },
    ]);
    expect(summarize(report)).toBe('1 of 3 documents invalid against Kubernetes ' + data.version + '.');
  });

  it('skips unknown kinds and versions with a warning', () => {
    const text =
      'apiVersion: cert-manager.io/v1\nkind: Certificate\nmetadata:\n  name: c\n---\napiVersion: apps/v1beta1\nkind: Deployment\nmetadata:\n  name: d\n';
    const report = run(text);
    expect(report.skipped).toBe(2);
    expect(report.issues.map((i) => [i.severity, i.message])).toEqual([
      ['warning', 'No schema bundled for cert-manager.io/v1 Certificate (custom resources aren’t covered); skipped.'],
      ['warning', 'No schema bundled for apps/v1beta1 Deployment (bundled: apps/v1); skipped.'],
    ]);
    expect(summarize(report)).toBe('No documents checked: 2 documents skipped.');
  });

  it('reports YAML syntax errors, non-mappings and missing apiVersion/kind', () => {
    const report = run('a: [\n---\nhello\n---\nkind: Pod\nmetadata: {name: x}\n');
    expect(report.invalid).toBe(3);
    expect(report.issues[0]?.message).toMatch(/^YAML syntax error/);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        document: 2,
        message: 'A Kubernetes document must be a mapping with apiVersion and kind.',
      }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ document: 3, path: 'apiVersion', message: 'Missing required field "apiVersion".' }),
    );
  });

  it('rejects a kind under the wrong apiVersion field type', () => {
    const report = run('apiVersion: 1\nkind: Pod\n');
    expect(report.issues).toEqual([
      { document: 1, severity: 'error', path: 'apiVersion', message: '"apiVersion" must be a string.', line: 1 },
    ]);
  });

  it('uses YAML 1.1 like Kubernetes, but keeps timestamps and h:m values as strings', () => {
    const text =
      'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: c\n  annotations:\n    when: 2024-01-01\n    t: 22:22\nimmutable: yes\n';
    expect(run(text).issues).toEqual([]);
  });

  it('rejects alias bombs', () => {
    const bomb = [
      'a: &a [x, x]',
      ...Array.from(
        { length: 12 },
        (_, i) => `${'b'.repeat(i + 1)}: &b${i} [*${i ? `b${i - 1}` : 'a'}, *${i ? `b${i - 1}` : 'a'}]`,
      ),
    ].join('\n');
    const report = run(bomb);
    expect(report.invalid).toBe(1);
  });

  it('adds best-practice warnings for workloads only when enabled', () => {
    const text = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: agent
spec:
  selector:
    matchLabels: {app: agent}
  template:
    metadata:
      labels: {app: agent}
    spec:
      hostNetwork: true
      containers:
        - name: agent
          image: registry.example.com:5000/agent
          securityContext:
            privileged: true
`;
    expect(run(text, false).issues).toEqual([]);
    const messages = run(text).issues.map((i) => `${i.line} ${i.path}: ${i.message}`);
    expect(messages).toEqual([
      '12 spec.template.spec.hostNetwork: hostNetwork: true exposes the node’s network stack.',
      '15 spec.template.spec.containers[0].image: Image "registry.example.com:5000/agent" has no tag, so it defaults to :latest. Pin a version or digest.',
      '14 spec.template.spec.containers[0]: Container "agent" has no resources.requests, so scheduling can’t plan for it.',
      '14 spec.template.spec.containers[0]: Container "agent" has no resources.limits; it can use unbounded CPU and memory.',
      '14 spec.template.spec.containers[0]: Container "agent" has no livenessProbe.',
      '14 spec.template.spec.containers[0]: Container "agent" has no readinessProbe.',
      '17 spec.template.spec.containers[0].securityContext.privileged: Container "agent" runs privileged, with full access to the host.',
      '14 spec.template.spec.containers[0]: Container "agent" doesn’t set runAsNonRoot: true (in its or the pod’s securityContext).',
    ]);
  });

  it('summarizes', () => {
    expect(summarize(run(''))).toBe('No documents to validate yet.');
    expect(summarize(run('# just a comment\n---\n'))).toBe('No documents to validate yet.');
    expect(summarize(run(TEMPLATES[0]?.yaml ?? ''))).toBe(`1 document valid against Kubernetes ${data.version}.`);
  });

  it('survives empty, huge and malformed input', () => {
    const f = (s: string) => validateManifests(s, data);
    expectRobust(f, {
      malformed: [
        '\u{1F680} \uD800 <script>alert(1)</script>',
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: c\ndata:\n  "\uD800": x\n',
        '{{ .Values.image }}',
        '- a\n- b',
        '!!binary aGVsbG8=',
        `${'- '.repeat(5000)}x`,
        'apiVersion: v1\nkind: Pod\nspec: {containers: [{}]}\n'.repeat(2000),
        '---\n'.repeat(1001) + 'a: 1',
      ],
    });
    expect(() => f('a'.repeat(1_000_001))).toThrow('too large');
  });
});

describe('helpers', () => {
  it('decodes instance locations', () => {
    expect(decodeLocation('#')).toEqual([]);
    expect(decodeLocation('#/metadata/annotations/a~1b~0c/0')).toEqual(['metadata', 'annotations', 'a/b~c', '0']);
    expect(decodeLocation('#/x/%E2%9C%93')).toEqual(['x', '✓']);
  });

  it('formats paths', () => {
    expect(formatPath(['spec', 'containers', '0', 'image'])).toBe('spec.containers[0].image');
    expect(formatPath(['metadata', 'labels', 'app.kubernetes.io/name'])).toBe(
      'metadata.labels["app.kubernetes.io/name"]',
    );
  });

  it('flags untagged and latest images but not digests', () => {
    expect(imageTagProblem('nginx')).toMatch(/no tag/);
    expect(imageTagProblem('nginx:latest')).toMatch(/:latest/);
    expect(imageTagProblem('localhost:5000/nginx')).toMatch(/no tag/);
    expect(imageTagProblem('localhost:5000/nginx:1.2')).toBeUndefined();
    expect(imageTagProblem('nginx@sha256:abc')).toBeUndefined();
  });
});
