import { UniverseTime } from '../../data/models/universe.models';
import { JULIAN_DAY_J2000 } from './time-utils';

export function calculateAxialRotation(time: UniverseTime, rotationPeriodHours: number): number {
  if (!Number.isFinite(rotationPeriodHours) || rotationPeriodHours === 0) {
    throw new Error('La période de rotation doit être un nombre fini non nul.');
  }
  const elapsedHours = (time.julianDay - JULIAN_DAY_J2000) * 24;
  const elapsedRotations = elapsedHours / rotationPeriodHours;
  const normalizedPhase = ((elapsedRotations % 1) + 1) % 1;

  return normalizedPhase * Math.PI * 2;
}
