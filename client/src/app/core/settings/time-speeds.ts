export type TimeSpeedId =
  'real-time' | 'minute' | 'hour' | 'day' | 'month' | 'year' | 'century' | 'million-years';

export interface TimeSpeedOption {
  readonly id: TimeSpeedId;
  readonly daysPerSecond: number;
}

export const TIME_SPEED_OPTIONS: readonly TimeSpeedOption[] = [
  { id: 'real-time', daysPerSecond: 1 / 86_400 },
  { id: 'minute', daysPerSecond: 1 / 1_440 },
  { id: 'hour', daysPerSecond: 1 / 24 },
  { id: 'day', daysPerSecond: 1 },
  { id: 'month', daysPerSecond: 30.4375 },
  { id: 'year', daysPerSecond: 365.25 },
  { id: 'century', daysPerSecond: 36_525 },
  {
    id: 'million-years',
    daysPerSecond: 365_250_000,
  },
];

export function findSpeedIndex(daysPerSecond: number): number {
  const index = TIME_SPEED_OPTIONS.findIndex((option) => option.daysPerSecond === daysPerSecond);

  return index >= 0 ? index : 3;
}
