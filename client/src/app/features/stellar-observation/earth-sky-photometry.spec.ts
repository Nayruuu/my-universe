import { earthSkyAppearanceForMagnitude } from './earth-sky-photometry';

describe('photométrie du mini-planétarium', () => {
  it('conserve l’ordre photométrique sans surexposer Sirius', () => {
    const sirius = earthSkyAppearanceForMagnitude(-1.46);
    const magnitudeTwo = earthSkyAppearanceForMagnitude(2);
    const limitingMagnitude = earthSkyAppearanceForMagnitude(6.5);

    expect(sirius.radius).toBeLessThanOrEqual(2.7);
    expect(sirius.opacity).toBeLessThanOrEqual(0.86);
    expect(sirius.haloOpacity).toBeLessThanOrEqual(0.16);
    expect(sirius.radius).toBeGreaterThan(magnitudeTwo.radius);
    expect(magnitudeTwo.radius).toBeGreaterThan(limitingMagnitude.radius);
    expect(sirius.opacity).toBeGreaterThan(magnitudeTwo.opacity);
    expect(magnitudeTwo.opacity).toBeGreaterThan(limitingMagnitude.opacity);
    expect(limitingMagnitude.haloOpacity).toBe(0);
  });

  it('borne les magnitudes extrêmes et dégradées', () => {
    expect(earthSkyAppearanceForMagnitude(-30)).toEqual({
      radius: 2.7,
      opacity: 0.86,
      haloOpacity: 0.16,
    });
    expect(earthSkyAppearanceForMagnitude(30)).toEqual({
      radius: 0.55,
      opacity: 0.18,
      haloOpacity: 0,
    });
    expect(earthSkyAppearanceForMagnitude(Number.NaN)).toEqual(earthSkyAppearanceForMagnitude(30));
  });
});
