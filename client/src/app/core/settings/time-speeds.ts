import { TimeSpeedOption } from '../../../data/models/universe.models';

export const TIME_SPEED_OPTIONS: readonly TimeSpeedOption[] = [
  { id: 'real-time', label: 'Temps réel', daysPerSecond: 1 / 86_400 },
  { id: 'minute', label: '1 minute / seconde', daysPerSecond: 1 / 1_440 },
  { id: 'hour', label: '1 heure / seconde', daysPerSecond: 1 / 24 },
  { id: 'day', label: '1 jour / seconde', daysPerSecond: 1 },
  { id: 'month', label: '1 mois / seconde', daysPerSecond: 30.4375 },
  { id: 'year', label: '1 an / seconde', daysPerSecond: 365.25 },
  { id: 'century', label: '100 ans / seconde', daysPerSecond: 36_525 },
  {
    id: 'million-years',
    label: '1 million d’années / seconde',
    daysPerSecond: 365_250_000,
  },
];

export function findSpeedIndex(daysPerSecond: number): number {
  const index = TIME_SPEED_OPTIONS.findIndex((option) => option.daysPerSecond === daysPerSecond);

  return index >= 0 ? index : 3;
}
