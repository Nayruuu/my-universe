import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from './astronomy-engine-time-domain';
import {
  calculateLunarEclipseAppearance,
  calculateLunarEclipseAppearanceFromVectors,
} from './lunar-eclipse-calculator';

describe('géométrie pure d’une éclipse lunaire', () => {
  it('refuse une direction d’ombre dégénérée sans produire de valeurs non finies', () => {
    const appearance = calculateLunarEclipseAppearanceFromVectors(
      { x: 0, y: 0, z: 0 },
      { x: 0.0025, y: 0, z: 0 },
    );

    expect(appearance).toEqual({
      phase: 'none',
      shadowAxis: { x: 0, y: 0, z: 0 },
      shadowOffsetInMoonRadii: { x: 0, y: 0, z: 0 },
      umbraRadiusInMoonRadii: 0,
      penumbraRadiusInMoonRadii: 0,
    });
  });

  it('n’invente pas d’éclipse un million d’années hors du domaine des éphémérides', () => {
    expect(
      calculateLunarEclipseAppearance({
        julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 365_250_000,
      }),
    ).toEqual({
      phase: 'none',
      shadowAxis: { x: 0, y: 0, z: 0 },
      shadowOffsetInMoonRadii: { x: 0, y: 0, z: 0 },
      umbraRadiusInMoonRadii: 0,
      penumbraRadiusInMoonRadii: 0,
    });
  });
});
