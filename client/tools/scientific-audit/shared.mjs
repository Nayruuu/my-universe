import { readFile } from 'node:fs/promises';

export const LIGHT_YEARS_PER_PARSEC = 3.261_563_777;
export const PARSECS_PER_KILOPARSEC = 1_000;
export const PARSECS_PER_MEGAPARSEC = 1_000_000;

const ASTRONOMICAL_UNITS_PER_PARSEC = 206_264.806_247_096_36;
const KILOMETERS_PER_ASTRONOMICAL_UNIT = 149_597_870.7;

export function addAnomaly(anomalies, family, id, reason) {
  anomalies.push({ family, id, reason });
}

export function dataView(buffer) {
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function equatorialCartesian(distance, rightAscensionDegrees, declinationDegrees) {
  const rightAscension = degreesToRadians(rightAscensionDegrees);
  const declination = degreesToRadians(declinationDegrees);
  const projectedDistance = distance * Math.cos(declination);

  return [
    projectedDistance * Math.cos(rightAscension),
    distance * Math.sin(declination),
    projectedDistance * Math.sin(rightAscension),
  ];
}

export function fromParsecs(value, unit) {
  switch (unit) {
    case 'kilometer':
      return value * KILOMETERS_PER_ASTRONOMICAL_UNIT * ASTRONOMICAL_UNITS_PER_PARSEC;
    case 'astronomical-unit':
      return value * ASTRONOMICAL_UNITS_PER_PARSEC;
    case 'light-year':
      return value * LIGHT_YEARS_PER_PARSEC;
    case 'parsec':
      return value;
    case 'kiloparsec':
      return value / PARSECS_PER_KILOPARSEC;
    case 'megaparsec':
      return value / PARSECS_PER_MEGAPARSEC;
    default:
      throw new Error(`Unsupported scientific-audit unit: ${unit}.`);
  }
}

export function isPositiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export async function readBinary(dataRoot, relativePath) {
  return readFile(new URL(relativePath, dataRoot));
}

export async function readJson(dataRoot, relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, dataRoot), 'utf8'));
}

export function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(right), Number.EPSILON);
}

export function toParsecs(value, unit) {
  switch (unit) {
    case 'kilometer':
      return value / (KILOMETERS_PER_ASTRONOMICAL_UNIT * ASTRONOMICAL_UNITS_PER_PARSEC);
    case 'astronomical-unit':
      return value / ASTRONOMICAL_UNITS_PER_PARSEC;
    case 'light-year':
      return value / LIGHT_YEARS_PER_PARSEC;
    case 'parsec':
      return value;
    case 'kiloparsec':
      return value * PARSECS_PER_KILOPARSEC;
    case 'megaparsec':
      return value * PARSECS_PER_MEGAPARSEC;
    default:
      throw new Error(`Unsupported scientific-audit unit: ${unit}.`);
  }
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}
