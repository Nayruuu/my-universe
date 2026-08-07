export type TimeSpeedId = 'hour' | 'day' | 'month' | 'year' | 'century' | 'million-years';

export interface TimeSpeedOption {
  readonly id: TimeSpeedId;
  readonly daysPerSecond: number;
}

export const TIME_SPEED_OPTIONS: readonly TimeSpeedOption[] = [
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
  const defaultIndex = TIME_SPEED_OPTIONS.findIndex((option) => option.id === 'day');

  return index >= 0 ? index : defaultIndex;
}
