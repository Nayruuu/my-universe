import { findSpeedIndex, TIME_SPEED_OPTIONS } from './time-speeds';

describe('vitesses temporelles', () => {
  it('retrouve chaque vitesse déclarée', () => {
    for (const [index, option] of TIME_SPEED_OPTIONS.entries()) {
      expect(findSpeedIndex(option.daysPerSecond)).toBe(index);
    }
  });

  it('retombe sur un jour par seconde pour une vitesse inconnue', () => {
    expect(findSpeedIndex(Number.NaN)).toBe(3);
  });
});
