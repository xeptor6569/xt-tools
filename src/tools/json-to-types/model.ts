// Infers a merged shape from sample JSON and names the object types in it.
// Pure: no DOM. Shared by every language emitter in logic.ts.
import { ToolInputError } from '../types.ts';

export const MAX_DEPTH = 200;

/** Everything seen at one position of the document, merged across samples. */
export interface Shape {
  /** Number of values merged into this shape. */
  seen: number;
  null: boolean;
  boolean: boolean;
  integer: boolean;
  float: boolean;
  string: boolean;
  /** An integer outside ±(2^53 − 1) was seen. */
  unsafeInt: boolean;
  /** An integer that doesn't fit in a signed 64-bit integer was seen. */
  hugeInt: boolean;
  /** Merged element shape of every array seen here (undefined when no array was seen). */
  array: Shape | undefined;
  /** At least one array was seen here. */
  isArray: boolean;
  object: ObjectShape | undefined;
}

export interface ObjectShape {
  /** Number of objects merged. */
  total: number;
  fields: Map<string, { shape: Shape; count: number }>;
}

export function emptyShape(): Shape {
  return {
    seen: 0,
    null: false,
    boolean: false,
    integer: false,
    float: false,
    string: false,
    unsafeInt: false,
    hugeInt: false,
    array: undefined,
    isArray: false,
    object: undefined,
  };
}

/** Wraps integral numbers that were written as floats in the source ("1.0"). */
export class FloatMarker {
  readonly value: number;
  constructor(value: number) {
    this.value = value;
  }
}

// 2^63, the first integer that doesn't fit in a signed 64-bit integer.
const INT64_LIMIT = 2 ** 63;

export function addSample(shape: Shape, value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw new ToolInputError(`The JSON is nested too deeply (more than ${MAX_DEPTH} levels).`);
  shape.seen++;
  if (value === null) shape.null = true;
  else if (typeof value === 'boolean') shape.boolean = true;
  else if (typeof value === 'string') shape.string = true;
  else if (typeof value === 'number') {
    if (!Number.isInteger(value)) shape.float = true;
    else {
      shape.integer = true;
      if (!Number.isSafeInteger(value)) shape.unsafeInt = true;
      if (Math.abs(value) >= INT64_LIMIT) shape.hugeInt = true;
    }
  } else if (value instanceof FloatMarker) {
    shape.float = true;
  } else if (Array.isArray(value)) {
    shape.isArray = true;
    shape.array ??= emptyShape();
    for (const item of value) addSample(shape.array, item, depth + 1);
  } else if (typeof value === 'object') {
    shape.object ??= { total: 0, fields: new Map() };
    const obj = shape.object;
    obj.total++;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      let field = obj.fields.get(key);
      if (!field) {
        field = { shape: emptyShape(), count: 0 };
        obj.fields.set(key, field);
      }
      field.count++;
      addSample(field.shape, child, depth + 1);
    }
  }
}

/** Parses JSON, keeping track of numbers written as floats. */
export function parseSample(input: string): unknown {
  try {
    return JSON.parse(input, (_key: string, value: unknown, context?: { source?: string }) => {
      if (typeof value === 'number' && Number.isInteger(value) && context?.source && /[.eE]/.test(context.source))
        return new FloatMarker(value);
      return value;
    });
  } catch (error) {
    // The reviver makes parsing recursive, so very deep nesting overflows the stack.
    if (error instanceof RangeError)
      throw new ToolInputError(`The JSON is nested too deeply (more than ${MAX_DEPTH} levels).`);
    const message = error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : String(error);
    throw new ToolInputError(`Invalid JSON: ${message}`);
  }
}

// ---------------------------------------------------------------- naming

/** Splits a key into ASCII words: "first-name" → [first, name], "userID" → [user, ID]. */
export function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** "first-name" → "FirstName". Returns "" when the key has no ASCII letters or digits. */
export function pascalCase(text: string): string {
  const name = words(text).map(cap).join('');
  return /^\d/.test(name) ? `N${name}` : name;
}

/** "firstName" → "first_name". Returns "" when the key has no ASCII letters or digits. */
export function snakeCase(text: string): string {
  return words(text)
    .map((w) => w.toLowerCase())
    .join('_');
}

const IRREGULAR: Record<string, string> = {
  children: 'child',
  people: 'person',
  men: 'man',
  women: 'woman',
  mice: 'mouse',
  geese: 'goose',
  feet: 'foot',
  teeth: 'tooth',
  movies: 'movie',
  indices: 'index',
  matrices: 'matrix',
  vertices: 'vertex',
};

/** Simple English singular of one lowercase word, or undefined when it doesn't look plural. */
export function singularWord(word: string): string | undefined {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 3 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (/(ss|x|ch|sh|zz)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('uses')) return w.slice(0, -2);
  if (w.length > 1 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return undefined;
}

/** Name for the element type of an array stored under `name`: "Users" → "User", "Data" → "DataItem". */
export function singularName(name: string): string {
  const parts = words(name);
  const last = parts.at(-1);
  const single = last && /^[A-Za-z]+$/.test(last) ? singularWord(last) : undefined;
  if (!single) return `${name}Item`;
  return pascalCase([...parts.slice(0, -1), single].join(' '));
}

// Type names that would clash with built-ins in at least one target language.
const RESERVED_TYPE_NAMES = new Set([
  'Any',
  'Array',
  'Boolean',
  'Box',
  'Date',
  'Dict',
  'Error',
  'False',
  'Function',
  'List',
  'Map',
  'None',
  'NotRequired',
  'Number',
  'Object',
  'Option',
  'Optional',
  'Promise',
  'Record',
  'Result',
  'Self',
  'Set',
  'String',
  'Symbol',
  'True',
  'TypedDict',
  'Union',
  'Value',
  'Vec',
]);

/** A named object type, ready for an emitter. */
export interface NamedType {
  name: string;
  object: ObjectShape;
}

export interface Model {
  root: Shape;
  rootName: string;
  /** Object types, parents before children. */
  types: NamedType[];
  /** Name of the type generated for an object shape. */
  nameOf: Map<ObjectShape, string>;
  notes: string[];
}

/** Interns a structural signature for every object shape, so identical shapes share one type. */
function signatures(root: Shape): Map<ObjectShape, number> {
  const ids = new Map<string, number>();
  const byShape = new Map<ObjectShape, number>();
  const sig = (shape: Shape): string => {
    const flags = [
      shape.null && 'n',
      shape.boolean && 'b',
      shape.integer && 'i',
      shape.float && 'f',
      shape.string && 's',
      shape.unsafeInt && 'u',
      shape.hugeInt && 'h',
    ]
      .filter(Boolean)
      .join('');
    const arr = shape.isArray ? `[${shape.array ? sig(shape.array) : ''}]` : '';
    const obj = shape.object ? `{${objectId(shape.object)}}` : '';
    return `${flags}${arr}${obj}`;
  };
  const objectId = (obj: ObjectShape): number => {
    const known = byShape.get(obj);
    if (known !== undefined) return known;
    const fields = [...obj.fields.entries()]
      .map(([key, f]) => `${JSON.stringify(key)}${f.count < obj.total ? '?' : ''}:${sig(f.shape)}`)
      .sort()
      .join(',');
    let id = ids.get(fields);
    if (id === undefined) {
      id = ids.size;
      ids.set(fields, id);
    }
    byShape.set(obj, id);
    return id;
  };
  sig(root);
  return byShape;
}

export function sanitizeRootName(name: string): string {
  return pascalCase(name) || 'Root';
}

/** Builds the model: merged shape, deduplicated and uniquely named object types, notes. */
export function buildModel(value: unknown, rootName: string): Model {
  const root = emptyShape();
  addSample(root, value);
  const sigs = signatures(root);
  const nameBySig = new Map<number, string>();
  const nameOf = new Map<ObjectShape, string>();
  const used = new Set<string>();
  const types: NamedType[] = [];
  const notes = new Set<string>();

  const unique = (wanted: string): string => {
    let base = wanted || 'Object';
    if (RESERVED_TYPE_NAMES.has(base)) base = `${base}Type`;
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    used.add(name);
    return name;
  };

  // A root that isn't always an object becomes an alias, so it keeps the root name.
  const k = kinds(root);
  const pureObject = k.object && k.count === 1 && !root.null;
  const alias = pureObject ? '' : unique(rootName);

  // Breadth-first, so shallower types get the plain names.
  const queue: Array<[Shape, string, string]> = [[root, pureObject ? rootName : `${rootName}Object`, '$']];
  for (let i = 0; i < queue.length; i++) {
    const [shape, wanted, path] = queue[i] as [Shape, string, string];
    if (shape.unsafeInt) {
      notes.add(
        `${path} has integers beyond 2^53 − 1; JavaScript's JSON.parse rounds them${shape.hugeInt ? ', and they do not fit in a signed 64-bit integer either' : ''}.`,
      );
    }
    if (shape.object) {
      const sig = sigs.get(shape.object) as number;
      let name = nameBySig.get(sig);
      const fresh = name === undefined;
      if (name === undefined) {
        name = unique(wanted);
        nameBySig.set(sig, name);
        types.push({ name, object: shape.object });
      }
      nameOf.set(shape.object, name);
      if (fresh) {
        for (const [key, field] of shape.object.fields) {
          queue.push([field.shape, pascalCase(key) || `${name}Field`, `${path}.${key}`]);
        }
      }
    }
    const arrayBase = i === 0 ? rootName : wanted;
    if (shape.array) queue.push([shape.array, singularName(arrayBase), `${path}[]`]);
  }
  const rootType = pureObject ? (nameOf.get(root.object as ObjectShape) ?? rootName) : alias;
  return { root, rootName: rootType, types, nameOf, notes: [...notes] };
}

/** Distinct kinds of value in a shape, ignoring null. */
export interface Kinds {
  boolean: boolean;
  integer: boolean;
  /** Float, or a mix of floats and integers. */
  number: boolean;
  string: boolean;
  array: boolean;
  object: boolean;
  /** Count of distinct non-null kinds. */
  count: number;
}

export function kinds(shape: Shape): Kinds {
  const number = shape.float;
  const integer = shape.integer && !shape.float;
  const k = {
    boolean: shape.boolean,
    integer,
    number,
    string: shape.string,
    array: shape.isArray,
    object: shape.object !== undefined,
  };
  return { ...k, count: Object.values(k).filter(Boolean).length };
}
