// Linear units convert by `perSi` (how many SI base units in one of these).
// Temperature is affine and is not mixed into arithmetic.

export type Dim = [number, number, number];

export interface LinearUnit {
  kind: 'linear';
  symbol: string;
  dim: Dim;
  /** 1 of this unit equals `perSi` SI units (m, kg, s). */
  perSi: number;
  aliases: string[];
}

export interface TempUnit {
  kind: 'temp';
  symbol: string;
  aliases: string[];
  toK: (value: number) => number;
  fromK: (kelvin: number) => number;
}

export type UnitDef = LinearUnit | TempUnit;

const L = (symbol: string, perSi: number, aliases: string[]): LinearUnit => ({
  kind: 'linear',
  symbol,
  dim: [1, 0, 0],
  perSi,
  aliases,
});
const M = (symbol: string, perSi: number, aliases: string[]): LinearUnit => ({
  kind: 'linear',
  symbol,
  dim: [0, 1, 0],
  perSi,
  aliases,
});
const T = (symbol: string, perSi: number, aliases: string[]): LinearUnit => ({
  kind: 'linear',
  symbol,
  dim: [0, 0, 1],
  perSi,
  aliases,
});

export const UNIT_DEFS: UnitDef[] = [
  L('nm', 1e-9, ['nm', 'nanometer', 'nanometers', 'nanometre', 'nanometres']),
  L('µm', 1e-6, ['um', 'µm', 'μm', 'micrometer', 'micrometers', 'micrometre', 'micrometres']),
  L('mm', 1e-3, ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres']),
  L('cm', 1e-2, ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres']),
  L('m', 1, ['m', 'meter', 'meters', 'metre', 'metres']),
  L('km', 1e3, ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres']),
  L('in', 0.0254, ['in', 'inch', 'inches']),
  L('ft', 0.3048, ['ft', 'foot', 'feet']),
  L('yd', 0.9144, ['yd', 'yard', 'yards']),
  L('mi', 1609.344, ['mi', 'mile', 'miles']),
  M('mg', 1e-6, ['mg', 'milligram', 'milligrams']),
  M('g', 1e-3, ['g', 'gram', 'grams']),
  M('kg', 1, ['kg', 'kilogram', 'kilograms']),
  M('t', 1000, ['t', 'tonne', 'tonnes']),
  M('oz', 0.028349523125, ['oz', 'ounce', 'ounces']),
  M('lb', 0.45359237, ['lb', 'lbs', 'pound', 'pounds']),
  T('ms', 1e-3, ['ms', 'millisecond', 'milliseconds']),
  T('s', 1, ['s', 'sec', 'secs', 'second', 'seconds']),
  T('min', 60, ['min', 'mins', 'minute', 'minutes']),
  T('h', 3600, ['h', 'hr', 'hrs', 'hour', 'hours']),
  T('d', 86_400, ['d', 'day', 'days']),
  {
    kind: 'linear',
    symbol: 'm/s',
    dim: [1, 0, -1],
    perSi: 1,
    aliases: ['m/s', 'mps'],
  },
  {
    kind: 'linear',
    symbol: 'km/h',
    dim: [1, 0, -1],
    perSi: 1000 / 3600,
    aliases: ['km/h', 'kmh', 'kph'],
  },
  {
    kind: 'linear',
    symbol: 'mph',
    dim: [1, 0, -1],
    perSi: 0.44704,
    aliases: ['mph'],
  },
  {
    kind: 'temp',
    symbol: '°C',
    aliases: ['c', '°c', 'celsius'],
    toK: (v) => v + 273.15,
    fromK: (k) => k - 273.15,
  },
  {
    kind: 'temp',
    symbol: '°F',
    aliases: ['f', '°f', 'fahrenheit'],
    toK: (v) => ((v - 32) * 5) / 9 + 273.15,
    fromK: (k) => ((k - 273.15) * 9) / 5 + 32,
  },
  {
    kind: 'temp',
    symbol: 'K',
    aliases: ['k', 'kelvin'],
    toK: (v) => v,
    fromK: (k) => k,
  },
];

const BY_ALIAS = new Map<string, UnitDef>();
for (const unit of UNIT_DEFS) {
  for (const alias of unit.aliases) BY_ALIAS.set(alias.toLowerCase(), unit);
}

export function lookupUnit(token: string): UnitDef | undefined {
  return BY_ALIAS.get(token.toLowerCase());
}
