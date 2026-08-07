import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  createEarthHorizonProfile,
  earthIllustrativeLandscapePresentation,
  projectEarthHorizonLandmark,
} from './earth-horizon-profile';

describe('profils illustratifs de l’horizon terrestre', () => {
  it('associe les huit horizons emblématiques à leur ville documentée', () => {
    expect(
      [
        location('paris', 'Paris', 48.8566, 2.3522),
        location('geonames-5128581', 'New York City', 40.71427, -74.00597),
        location('geonames-1850147', 'Tokyo', 35.6895, 139.69171),
        location('geonames-2643743', 'London', 51.50853, -0.12574),
        location('geonames-2147714', 'Sydney', -33.86785, 151.20732),
        location('geonames-360630', 'Cairo', 30.06263, 31.24967),
        location('geonames-3451190', 'Rio de Janeiro', -22.90642, -43.18223),
        location('geonames-1835848', 'Seoul', 37.566, 126.9784),
      ].map((observer) => {
        const profile = createEarthHorizonProfile(observer);

        return [profile.cityscapeKind, profile.landmark?.kind];
      }),
    ).toEqual([
      ['paris', 'eiffel-tower'],
      ['new-york', 'statue-of-liberty'],
      ['tokyo', 'mount-fuji'],
      ['london', 'elizabeth-tower'],
      ['sydney', 'sydney-opera-house'],
      ['cairo', 'giza-pyramids'],
      ['rio', 'christ-the-redeemer'],
      ['seoul', 'n-seoul-tower'],
    ]);
  });

  it('calcule la direction réelle du monument depuis le point de ville', () => {
    const paris = createEarthHorizonProfile(location('paris', 'Paris', 48.8566, 2.3522));

    expect(paris.landmark?.bearingDegrees).toBeCloseTo(272.6903, 3);
    expect(paris.landmark?.name).toBe('Tour Eiffel');
    expect(paris.landmark?.scale).toBe(2.16);
    expect(paris.lightHueDegrees).toBe(38);
    expect(paris.lightDensity).toBe('dense');
    expect(paris.farRidgeClipPath).toContain('4.00% 56.00%');
    expect(paris.nearRidgeClipPath).toContain('2.00% 42.00%');
  });

  it('génère un horizon stable mais distinct pour chaque ville et pour les coordonnées libres', () => {
    const paris = createEarthHorizonProfile(location('paris', 'Paris', 48.8566, 2.3522));
    const lyon = createEarthHorizonProfile(location('lyon', 'Lyon', 45.764, 4.8357));
    const custom = createEarthHorizonProfile(
      location('coordinates-40.000000-3.000000', 'Observatoire privé', 40, 3),
    );

    expect(paris.farRidgeClipPath).toBe(createEarthHorizonProfile(paris.location).farRidgeClipPath);
    expect(paris.farRidgeClipPath).not.toBe(lyon.farRidgeClipPath);
    expect(lyon.nearRidgeClipPath).not.toBe(custom.nearRidgeClipPath);
    expect(lyon.cityscapeKind).toBe('procedural');
    expect(lyon.lightDensity).toBe('quiet');
    expect(lyon.landscapeKind).toBe('cityscape');
    expect(lyon.landmark).toBeNull();
    expect(custom.landscapeKind).toBe('plain');
    expect(custom.cityscapeKind).toBe('procedural');
    expect(custom.lightDensity).toBe('quiet');
    expect(custom.farRidgeClipPath).toContain('10.00%');
    expect(custom.landmark).toBeNull();
  });

  it('projette le monument dans le champ horizontal et traverse correctement le nord', () => {
    const landmark = {
      kind: 'eiffel-tower' as const,
      name: 'Repère',
      bearingDegrees: 5,
      scale: 1,
    };
    const projection = projectEarthHorizonLandmark(landmark, {
      centerAzimuthDegrees: 350,
      verticalFieldOfViewDegrees: 82,
      viewport: { width: 1_600, height: 900 },
    });

    expect(projection).not.toBeNull();
    expect(projection!.xPercent).toBeGreaterThan(50);
    expect(projection!.xPercent).toBeLessThan(70);
    expect(
      projectEarthHorizonLandmark(landmark, {
        centerAzimuthDegrees: 180,
        verticalFieldOfViewDegrees: 82,
        viewport: { width: 1_600, height: 900 },
      }),
    ).toBeNull();
    expect(
      projectEarthHorizonLandmark(landmark, {
        centerAzimuthDegrees: 295,
        verticalFieldOfViewDegrees: 82,
        viewport: { width: 1_600, height: 900 },
      }),
    ).toBeNull();
  });

  it('borne les dimensions de projection invalides sans perdre le repère central', () => {
    const landmark = {
      kind: 'eiffel-tower' as const,
      name: 'Repère',
      bearingDegrees: 45,
      scale: 1,
    };
    const projection = projectEarthHorizonLandmark(landmark, {
      centerAzimuthDegrees: 45,
      verticalFieldOfViewDegrees: Number.NaN,
      viewport: { width: 0, height: 0 },
    });

    expect(projection).toEqual({
      kind: 'eiffel-tower',
      name: 'Repère',
      scale: 1,
      xPercent: 50,
    });
  });

  it('retire progressivement le décor illustratif avant les champs télescopiques', () => {
    expect(earthIllustrativeLandscapePresentation(82)).toEqual({ opacity: 1, state: 'full' });
    expect(earthIllustrativeLandscapePresentation(30)).toEqual({ opacity: 0.5, state: 'fading' });
    expect(earthIllustrativeLandscapePresentation(18)).toEqual({ opacity: 0, state: 'hidden' });
    expect(earthIllustrativeLandscapePresentation(2)).toEqual({ opacity: 0, state: 'hidden' });
    expect(earthIllustrativeLandscapePresentation(Number.NaN)).toEqual({
      opacity: 1,
      state: 'full',
    });
  });
});

function location(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): EarthObserverLocation {
  return { id, name, latitude, longitude, timeZone: 'UTC' };
}
