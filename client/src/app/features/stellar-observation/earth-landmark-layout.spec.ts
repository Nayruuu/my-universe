import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { EarthLandmarkDefinition } from './earth-landmark-catalog';
import { earthLandmarkBearingDegrees, projectEarthLandmarkLayouts } from './earth-landmark-layout';

describe('projection des repères terrestres sur le panorama', () => {
  const observer: EarthObserverLocation = {
    id: 'origin',
    name: 'Origin',
    latitude: 0,
    longitude: 0,
    timeZone: 'UTC',
  };

  it('projette les quatre points cardinaux sur le panorama circulaire', () => {
    expect(earthLandmarkBearingDegrees(observer, point(1, 0))).toBeCloseTo(0, 8);
    expect(earthLandmarkBearingDegrees(observer, point(0, 1))).toBeCloseTo(90, 8);
    expect(earthLandmarkBearingDegrees(observer, point(-1, 0))).toBeCloseTo(180, 8);
    expect(earthLandmarkBearingDegrees(observer, point(0, -1))).toBeCloseTo(270, 8);

    const layouts = projectEarthLandmarkLayouts(
      observer,
      [
        landmark('north', 1, 0, 100),
        landmark('east', 0, 1, 100),
        landmark('south', -1, 0, 100),
        landmark('west', 0, -1, 100),
      ],
      1,
    );

    expect(layouts.map(({ centerX }) => centerX)).toEqual([0, 1_800, 3_600, 5_400]);
    expect(layouts.every(({ y, height }) => y + height === 320)).toBe(true);
  });

  it('conserve les rapports angulaires à distance égale sans rendre les petits repères invisibles', () => {
    const layouts = projectEarthLandmarkLayouts(
      observer,
      [
        landmark('tall', 1, 0, 500, 'tower', 4_000),
        landmark('middle', 0, 1, 250, 'tower', 4_000),
        landmark('small', -1, 0, 20, 'tower', 4_000),
      ],
      1.5,
      { verticalFieldOfViewDegrees: 82, viewportHeight: 900 },
    );

    expect(layouts[0]!.height).toBeCloseTo(117.27, 1);
    expect(layouts[1]!.height).toBeCloseTo(58.84, 1);
    expect(layouts[1]!.height / layouts[0]!.height).toBeCloseTo(0.5017, 3);
    expect(layouts[2]!.height).toBe(54);
    expect(layouts.every(({ width, height }) => width === height)).toBe(true);
  });

  it('rend un même bâtiment plus petit lorsqu’il est plus éloigné', () => {
    const [near, far] = projectEarthLandmarkLayouts(
      observer,
      [landmark('near', 1, 0, 80, 'tower', 500), landmark('far', 0, 1, 80, 'tower', 5_000)],
      1,
      { verticalFieldOfViewDegrees: 82, viewportHeight: 900 },
    );

    expect(near!.height).toBeGreaterThan(far!.height * 2);
    expect(far!.height).toBe(36);
  });

  it('utilise une hauteur visuelle typée et conserve toute la provenance', () => {
    const source = landmark('unknown-height', 0.5, 0.5, null, 'bridge');
    const [layout] = projectEarthLandmarkLayouts(observer, [source], Number.NaN, {
      verticalFieldOfViewDegrees: Number.NaN,
      viewportHeight: Number.NaN,
    });

    expect(layout).toMatchObject({
      id: 'unknown-height',
      category: 'bridge',
      heightMeters: null,
      heightConfidence: 'unknown',
      scientificConfidence: 'observed',
      visualConfidence: 'illustrative',
      sourceTitle: 'Documented source',
      sourceUrl: 'https://example.com/source',
      effectiveHeightMeters: 80,
    });
    expect(layout!.height).toBeCloseTo(50.2, 1);
    expect(layout!.width).toBeCloseTo(50.2, 1);
  });

  it('adapte les hauteurs inconnues au type de silhouette sans les présenter comme mesurées', () => {
    const [skyscraper, cathedral] = projectEarthLandmarkLayouts(
      observer,
      [
        { ...landmark('office', 1, 0, null, 'tower'), name: 'One World Trade Center' },
        { ...landmark('church', 0, 1, null, 'religious'), name: 'City Cathedral' },
      ],
      1,
    );

    expect(skyscraper).toMatchObject({ effectiveHeightMeters: 220, heightConfidence: 'unknown' });
    expect(cathedral).toMatchObject({ effectiveHeightMeters: 90, heightConfidence: 'unknown' });
  });

  it('stabilise la projection lorsqu’un repère partage la coordonnée approximative de la ville', () => {
    const [layout] = projectEarthLandmarkLayouts(
      observer,
      [landmark('city-centre', 0, 0, 55, 'civic', 0)],
      1,
      { verticalFieldOfViewDegrees: 82, viewportHeight: 900 },
    );

    expect(layout).toMatchObject({ distanceMeters: 0, visualDistanceMeters: 500 });
    expect(layout!.height).toBeGreaterThan(36);
    expect(layout!.height).toBeLessThan(112);
  });

  it('accepte une collection vide', () => {
    expect(projectEarthLandmarkLayouts(observer, [], 1)).toEqual([]);
  });
});

function point(
  latitude: number,
  longitude: number,
): Pick<EarthLandmarkDefinition, 'latitude' | 'longitude'> {
  return { latitude, longitude };
}

function landmark(
  id: string,
  latitude: number,
  longitude: number,
  heightMeters: number | null,
  category: EarthLandmarkDefinition['category'] = 'tower',
  distanceMeters = 1_000,
): EarthLandmarkDefinition {
  return {
    category,
    distanceMeters,
    heightConfidence: heightMeters === null ? 'unknown' : 'documented',
    heightMeters,
    id,
    latitude,
    longitude,
    name: id,
    scientificConfidence: 'observed',
    selectionMethod: 'wikimedia-geosearch',
    silhouettePath: 'M0 0H100V100H0Z',
    sourceAspectRatio: 1,
    sourceTitle: 'Documented source',
    sourceUrl: 'https://example.com/source',
    sourceViewBox: '0 0 100 100',
    visualConfidence: 'illustrative',
    wikidataId: 'Q1',
    wikipediaUrl: 'https://example.com/article',
  };
}
