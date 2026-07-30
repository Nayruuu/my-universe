import { calculateAxialRotation } from './body-rotation';
import { JULIAN_DAY_J2000 } from './time-utils';

describe('rotation axiale', () => {
  it('dérive un angle stable uniquement depuis le temps simulé', () => {
    const time = { julianDay: JULIAN_DAY_J2000 + 0.25 };

    expect(calculateAxialRotation(time, 24)).toBeCloseTo(Math.PI / 2, 10);
    expect(calculateAxialRotation(time, 24)).toBe(calculateAxialRotation(time, 24));
  });

  it('respecte une rotation rétrograde', () => {
    const time = { julianDay: JULIAN_DAY_J2000 + 0.25 };

    expect(calculateAxialRotation(time, -24)).toBeCloseTo((Math.PI * 3) / 2, 10);
  });

  it('rejette une période inexploitable', () => {
    expect(() => calculateAxialRotation({ julianDay: JULIAN_DAY_J2000 }, 0)).toThrow(
      'La période de rotation doit être un nombre fini non nul.',
    );
  });
});
