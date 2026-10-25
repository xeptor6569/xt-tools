import { ToolInputError } from '../types.ts';

const MAX_INPUT = 120;
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
/** Precision used when encoding decimal degrees or DMS. 11 matches the classic vector. */
export const GEOHASH_PRECISION = 11;

export interface GeoCell {
  lat: number;
  lon: number;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export function encodeGeohash(lat: number, lon: number, precision = GEOHASH_PRECISION): string {
  if (precision < 1 || precision > 12) throw new ToolInputError('Geohash precision must be from 1 to 12.');
  let hash = '';
  let bits = 0;
  let value = 0;
  let even = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        value = value * 2 + 1;
        lonMin = mid;
      } else {
        value *= 2;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        value = value * 2 + 1;
        latMin = mid;
      } else {
        value *= 2;
        latMax = mid;
      }
    }
    even = !even;
    bits++;
    if (bits === 5) {
      hash += BASE32.charAt(value);
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

export function decodeGeohash(hash: string): GeoCell {
  const text = hash.trim().toLowerCase();
  if (!/^[0-9bcdefghjkmnpqrstuvwxyz]{1,12}$/.test(text)) {
    throw new ToolInputError('A geohash uses digits and the letters b–z except a, i, l and o.');
  }
  let even = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  for (const ch of text) {
    const idx = BASE32.indexOf(ch);
    for (let bit = 4; bit >= 0; bit--) {
      const upper = (idx & (1 << bit)) !== 0;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (upper) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (upper) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2, latMin, latMax, lonMin, lonMax };
}

function formatDeg(value: number): string {
  const text = value.toFixed(8).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

function formatDms(value: number, positive: string, negative: string): string {
  const hemisphere = value < 0 ? negative : positive;
  const abs = Math.abs(value);
  let degrees = Math.floor(abs + 1e-12);
  const minutesFloat = (abs - degrees) * 60;
  let minutes = Math.floor(minutesFloat + 1e-12);
  let seconds = Math.round((minutesFloat - minutes) * 60 * 100) / 100;
  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }
  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(2)}"${hemisphere}`;
}

export function formatCoordinate(lat: number, lon: number, hash: string): string {
  return [
    `Decimal: ${formatDeg(lat)}, ${formatDeg(lon)}`,
    `DMS: ${formatDms(lat, 'N', 'S')} ${formatDms(lon, 'E', 'W')}`,
    `Geohash: ${hash}`,
  ].join('\n');
}

function assertRange(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new ToolInputError('Enter finite coordinates.');
  if (lat < -90 || lat > 90) throw new ToolInputError('Latitude must be between -90 and 90. Put latitude first.');
  if (lon < -180 || lon > 180) throw new ToolInputError('Longitude must be between -180 and 180.');
}

function parseDecimal(text: string): { lat: number; lon: number } | undefined {
  const match =
    /^\s*([+-]?\d+(?:\.\d+)?)\s*[,;]\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(text) ??
    /^\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match?.[1] || !match[2]) return undefined;
  return { lat: Number(match[1]), lon: Number(match[2]) };
}

interface DmsPiece {
  hemisphere: string;
  degrees: number;
  minutes: number;
  seconds: number;
}

function parseDms(text: string): { lat: number; lon: number } | undefined {
  const normalized = text.replace(/[′’]/g, "'").replace(/[″“”]/g, '"').replace(/º/g, '°');
  const re =
    /([NSEW])?\s*(\d+(?:\.\d+)?)(?:\s*°)?(?:\s*(\d+(?:\.\d+)?)(?:\s*')?)?(?:\s*(\d+(?:\.\d+)?)(?:\s*")?)?\s*([NSEW](?!\d))?/gi;
  const pieces: DmsPiece[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const degrees = match[2];
    if (!degrees) break;
    const hemisphere = (match[5] || match[1] || '').toUpperCase();
    if (!hemisphere) return undefined;
    const minutes = match[3] ? Number(match[3]) : 0;
    const seconds = match[4] ? Number(match[4]) : 0;
    if (minutes >= 60 || seconds >= 60) throw new ToolInputError('Minutes and seconds must be under 60.');
    pieces.push({ hemisphere, degrees: Number(degrees), minutes, seconds });
    if (match.index === re.lastIndex) re.lastIndex++;
    if (pieces.length === 2) break;
  }
  if (pieces.length !== 2) return undefined;
  if (normalized.slice(re.lastIndex).trim() !== '') return undefined;
  const signed = (piece: DmsPiece) => {
    const value = piece.degrees + piece.minutes / 60 + piece.seconds / 3600;
    return piece.hemisphere === 'S' || piece.hemisphere === 'W' ? -value : value;
  };
  const first = pieces[0];
  const second = pieces[1];
  if (!first || !second) return undefined;
  const latPiece = first.hemisphere === 'N' || first.hemisphere === 'S' ? first : second;
  const lonPiece = first.hemisphere === 'E' || first.hemisphere === 'W' ? first : second;
  if (latPiece === lonPiece) throw new ToolInputError('DMS needs one N/S hemisphere and one E/W hemisphere.');
  if (!(latPiece.hemisphere === 'N' || latPiece.hemisphere === 'S')) {
    throw new ToolInputError('DMS needs one N/S hemisphere and one E/W hemisphere.');
  }
  if (!(lonPiece.hemisphere === 'E' || lonPiece.hemisphere === 'W')) {
    throw new ToolInputError('DMS needs one N/S hemisphere and one E/W hemisphere.');
  }
  return { lat: signed(latPiece), lon: signed(lonPiece) };
}

function isGeohash(text: string): boolean {
  return /[a-z]/i.test(text) && /^[0-9bcdefghjkmnpqrstuvwxyz]{1,12}$/i.test(text);
}

/** Converts decimal degrees, DMS and geohash into all three forms. */
export function geoConverter(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 120 characters).');
  const text = input.trim();
  if (text === '') return '';
  if (isGeohash(text)) {
    const hash = text.toLowerCase();
    const cell = decodeGeohash(hash);
    return formatCoordinate(cell.lat, cell.lon, hash);
  }
  const decimal = parseDecimal(text);
  const dms = decimal ? undefined : parseDms(text);
  const point = decimal ?? dms;
  if (!point) {
    throw new ToolInputError('Enter a decimal pair (48.8584, 2.2945), DMS, or a geohash.');
  }
  assertRange(point.lat, point.lon);
  return formatCoordinate(point.lat, point.lon, encodeGeohash(point.lat, point.lon));
}
