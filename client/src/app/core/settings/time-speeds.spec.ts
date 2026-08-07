import { findSpeedIndex, TIME_SPEED_OPTIONS } from './time-speeds';

describe('vitesses temporelles', () => {
  it('commence à une heure par seconde sans exposer les vitesses peu utiles', () => {
    const speedIds: readonly string[] = TIME_SPEED_OPTIONS.map((option) => option.id);

    expect(TIME_SPEED_OPTIONS[0]).toEqual({ id: 'hour', daysPerSecond: 1 / 24 });
    expect(speedIds).not.toContain('real-time');
    expect(speedIds).not.toContain('minute');
    expect(speedIds).toContain('day');
  });

  it('retrouve chaque vitesse déclarée', () => {
    for (const [index, option] of TIME_SPEED_OPTIONS.entries()) {
      expect(findSpeedIndex(option.daysPerSecond)).toBe(index);
    }
  });

  it('retombe sur un jour par seconde pour une vitesse inconnue', () => {
    expect(TIME_SPEED_OPTIONS[findSpeedIndex(Number.NaN)]?.id).toBe('day');
  });
});
