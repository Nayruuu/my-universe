import { DistanceUnit } from '../../data/models/universe.models';

const KILOMETERS_PER_PARSEC = Number('30856775814913.672');

const KILOMETERS_PER_UNIT: Readonly<Record<DistanceUnit, number>> = {
  meter: 0.001,
  kilometer: 1,
  'astronomical-unit': 149_597_870.7,
  'light-year': 9_460_730_472_580.8,
  parsec: KILOMETERS_PER_PARSEC,
  kiloparsec: KILOMETERS_PER_PARSEC * 1_000,
  megaparsec: KILOMETERS_PER_PARSEC * 1_000_000,
};

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  return (value * KILOMETERS_PER_UNIT[from]) / KILOMETERS_PER_UNIT[to];
}

export function unitInKilometers(unit: DistanceUnit): number {
  return KILOMETERS_PER_UNIT[unit];
}
