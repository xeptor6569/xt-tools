// Dataset: JSON schemas for common Kubernetes kinds, derived from the official
// OpenAPI v2 spec (api/openapi-spec/swagger.json, Apache-2.0) at the latest
// kubernetes/kubernetes release. Used by src/tools/k8s-manifest.
//
// The transform keeps only definitions reachable from KINDS, strips
// documentation and non-validating extensions, turns IntOrString and Quantity
// into string-or-number types, makes objects with declared properties strict
// (additionalProperties: false) and adds a root schema per kind that pins
// apiVersion and kind. The result is draft-4 JSON Schema.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dataset } from '../refresh-data.ts';
import { ROOT } from '../lib/tools.ts';

const REPO = 'kubernetes/kubernetes';
const CONSTANT_FILE = join(ROOT, 'src', 'tools', 'k8s-manifest', 'dataset.ts');

/** [apiVersion, kind] pairs to bundle. */
export const KINDS: ReadonlyArray<readonly [string, string]> = [
  ['v1', 'Pod'],
  ['apps/v1', 'Deployment'],
  ['apps/v1', 'StatefulSet'],
  ['apps/v1', 'DaemonSet'],
  ['apps/v1', 'ReplicaSet'],
  ['batch/v1', 'Job'],
  ['batch/v1', 'CronJob'],
  ['v1', 'Service'],
  ['networking.k8s.io/v1', 'Ingress'],
  ['networking.k8s.io/v1', 'IngressClass'],
  ['v1', 'ConfigMap'],
  ['v1', 'Secret'],
  ['v1', 'PersistentVolume'],
  ['v1', 'PersistentVolumeClaim'],
  ['storage.k8s.io/v1', 'StorageClass'],
  ['v1', 'Namespace'],
  ['v1', 'ServiceAccount'],
  ['rbac.authorization.k8s.io/v1', 'Role'],
  ['rbac.authorization.k8s.io/v1', 'RoleBinding'],
  ['rbac.authorization.k8s.io/v1', 'ClusterRole'],
  ['rbac.authorization.k8s.io/v1', 'ClusterRoleBinding'],
  ['networking.k8s.io/v1', 'NetworkPolicy'],
  ['autoscaling/v2', 'HorizontalPodAutoscaler'],
  ['policy/v1', 'PodDisruptionBudget'],
  ['v1', 'LimitRange'],
  ['v1', 'ResourceQuota'],
  ['scheduling.k8s.io/v1', 'PriorityClass'],
  ['discovery.k8s.io/v1', 'EndpointSlice'],
];

type Schema = Record<string, unknown>;

interface Gvk {
  group: string;
  version: string;
  kind: string;
}

const PREFIXES = [
  'io.k8s.api.',
  'io.k8s.apimachinery.pkg.apis.',
  'io.k8s.apimachinery.pkg.api.',
  'io.k8s.apimachinery.pkg.util.',
  'io.k8s.apimachinery.pkg.',
  'io.k8s.',
];
const REF_PREFIX = '#/definitions/';
const INT_OR_STRING = 'io.k8s.apimachinery.pkg.util.intstr.IntOrString';
const QUANTITY = 'io.k8s.apimachinery.pkg.api.resource.Quantity';

function compactName(full: string): string {
  const prefix = PREFIXES.find((p) => full.startsWith(p));
  return prefix ? full.slice(prefix.length) : full;
}

function refTarget(schema: Schema): string | undefined {
  const ref = schema.$ref;
  return typeof ref === 'string' && ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : undefined;
}

/** Converts one OpenAPI schema node into compact draft-4 JSON Schema. */
function convert(node: Schema, rename: (full: string) => string): Schema {
  const target = refTarget(node);
  if (target) {
    if (target === INT_OR_STRING) return { type: ['string', 'integer'] };
    if (target === QUANTITY) return { type: ['string', 'number'] };
    return { $ref: REF_PREFIX + rename(target) };
  }
  if (node.format === 'int-or-string' || node['x-kubernetes-int-or-string'] === true) {
    return { type: ['string', 'integer'] };
  }
  const out: Schema = {};
  if (node.type !== undefined) out.type = node.type;
  if (Array.isArray(node.enum)) out.enum = node.enum;
  const props = node.properties as Record<string, Schema> | undefined;
  if (props) {
    out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, convert(v, rename)]));
  }
  if (Array.isArray(node.required) && node.required.length > 0) out.required = node.required;
  if (node.items && typeof node.items === 'object') out.items = convert(node.items as Schema, rename);
  if (typeof node.additionalProperties === 'boolean') out.additionalProperties = node.additionalProperties;
  else if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    out.additionalProperties = convert(node.additionalProperties as Schema, rename);
  } else if (props && node['x-kubernetes-preserve-unknown-fields'] !== true) {
    out.additionalProperties = false;
  }
  return out;
}

export function transform(spec: { definitions: Record<string, Schema> }, version: string) {
  const defs = spec.definitions;
  const byGvk = new Map<string, string>();
  for (const [name, def] of Object.entries(defs)) {
    const gvks = def['x-kubernetes-group-version-kind'] as Gvk[] | undefined;
    if (!gvks || gvks.length !== 1) continue; // shared types like DeleteOptions list many
    const g = gvks[0] as Gvk;
    byGvk.set(`${g.group ? `${g.group}/` : ''}${g.version} ${g.kind}`, name);
  }

  // Walk the reference graph from the curated kinds.
  const roots = KINDS.map(([apiVersion, kind]) => {
    const name = byGvk.get(`${apiVersion} ${kind}`);
    if (!name) throw new Error(`No definition for ${apiVersion} ${kind} in the spec.`);
    return { apiVersion, kind, name };
  });
  const reachable = new Set<string>();
  const queue = roots.map((r) => r.name);
  const collect = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(collect);
    const target = refTarget(node as Schema);
    if (target && target !== INT_OR_STRING && target !== QUANTITY) queue.push(target);
    for (const v of Object.values(node)) collect(v);
  };
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (reachable.has(name)) continue;
    const def = defs[name];
    if (!def) throw new Error(`Dangling $ref to ${name}.`);
    reachable.add(name);
    collect(def);
  }

  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const full of [...reachable].sort()) {
    let short = compactName(full);
    if (used.has(short)) short = full;
    used.add(short);
    names.set(full, short);
  }
  const rename = (full: string) => names.get(full) ?? full;

  const definitions: Record<string, Schema> = {};
  for (const full of [...reachable].sort()) definitions[rename(full)] = convert(defs[full] as Schema, rename);

  // A stricter copy of each kind's schema for top-level documents: the shared
  // definition is also used for embedded objects (e.g. volumeClaimTemplates)
  // where apiVersion and kind are optional.
  const kinds = roots.map(({ apiVersion, kind, name }) => {
    const base = definitions[rename(name)] as Schema;
    const ref = `${rename(name)}.root`;
    const required = new Set([...((base.required as string[] | undefined) ?? []), 'apiVersion', 'kind']);
    definitions[ref] = {
      ...base,
      properties: {
        ...(base.properties as Record<string, Schema>),
        apiVersion: { type: 'string', enum: [apiVersion] },
        kind: { type: 'string', enum: [kind] },
      },
      required: [...required],
    };
    return { apiVersion, kind, ref };
  });

  return { version, kinds, definitions };
}

async function getJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'xt-tools-refresh-data',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function refresh(): Promise<Dataset> {
  const release = await getJson<{ tag_name: string }>(`https://api.github.com/repos/${REPO}/releases/latest`);
  const tag = release.tag_name;
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Unexpected release tag ${tag}.`);
  console.log(`  latest Kubernetes release: ${tag}`);
  const spec = await getJson<{ definitions: Record<string, Schema> }>(
    `https://raw.githubusercontent.com/${REPO}/${tag}/api/openapi-spec/swagger.json`,
  );
  const data = transform(spec, tag);
  const content = JSON.stringify(data);
  console.log(`  ${data.kinds.length} kinds, ${Object.keys(data.definitions).length} definitions`);

  const file = `k8s-${tag}.json`;
  writeFileSync(
    CONSTANT_FILE,
    `// Generated by \`node scripts/refresh-data.ts k8s\`. Do not edit by hand.\nexport const DATA_FILE = 'data/${file}';\n`,
  );
  console.log(`  ~ src/tools/k8s-manifest/dataset.ts -> data/${file}`);

  return {
    name: 'k8s',
    file,
    content,
    source: 'kubernetes/kubernetes `api/openapi-spec/swagger.json`',
    url: `https://github.com/${REPO}/blob/${tag}/api/openapi-spec/swagger.json`,
    version: tag,
    license: 'Apache-2.0',
    tool: 'k8s-manifest',
    notes: `Draft-4 JSON Schemas for ${data.kinds.length} built-in kinds (${data.kinds.map((k) => k.kind).join(', ')}), reduced to the definitions they reference. Descriptions and formats are stripped, IntOrString and Quantity become string-or-number, objects with declared properties reject unknown fields, and each kind has a \`.root\` schema that requires its apiVersion and kind.`,
  };
}
