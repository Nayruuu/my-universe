import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';
import { projectEarthTerrainHorizon } from './earth-terrain-horizon-projection';

describe('Earth terrain horizon projection', () => {
  it('projects geographic azimuth samples into the current perspective', () => {
    const profile = terrainProfile([100, 300, 500, 700], 90);
    const projection = projectEarthTerrainHorizon(profile, {
      centerAzimuthDegrees: 45,
      verticalFieldOfViewDegrees: 90,
      viewport: { width: 1_600, height: 900 },
    });

    expect(projection.heightPixels).toBe(180);
    expect(projection.viewBox).toBe('0 0 1024 180');
    expect(projection.path).toMatch(/^M 0 180 L 0\.000 /u);
    expect(projection.path).toContain('L 512.000 162.500');
    expect(projection.path).toMatch(/L 1024 180 Z$/u);
    expect(projection.ridgePath).toMatch(/^M 0.000 /u);
    expect(projection.ridgePath).toContain('L 512.000 162.500');
    expect(projection.distanceLayers.map((layer) => layer.id)).toEqual(['far', 'mid', 'near']);
  });

  it('adapte sa hauteur aux sommets afin de conserver leur échelle angulaire', () => {
    const projection = projectEarthTerrainHorizon(terrainProfile([2_400], 360), {
      centerAzimuthDegrees: 0,
      verticalFieldOfViewDegrees: 82,
      viewport: { width: 2_304, height: 1_041 },
    });

    expect(projection.heightPixels).toBeGreaterThan(300);
    expect(projection.viewBox).toBe(`0 0 1024 ${projection.heightPixels}`);
    expect(Number(projection.ridgePath.split(' ').at(-1))).toBeCloseTo(16, 0);
  });

  it('borne un relief extrême et accepte des dimensions de viewport dégénérées', () => {
    const projection = projectEarthTerrainHorizon(terrainProfile([9_000], 360), {
      centerAzimuthDegrees: 0,
      verticalFieldOfViewDegrees: 0,
      viewport: { width: 0, height: 0 },
    });

    expect(projection.heightPixels).toBe(1);
    expect(projection.path).toContain(' 0.000');
  });
});

function terrainProfile(
  samples: readonly number[],
  azimuthStepDegrees: number,
): EarthTerrainHorizonProfile {
  const distanceBands = [
    { id: 'near' as const, minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
    { id: 'mid' as const, minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
    { id: 'far' as const, minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
  ];

  return {
    locationId: 'paris',
    latitude: 48.8566,
    longitude: 2.3522,
    observerElevationMeters: 37,
    azimuthStepDegrees,
    distanceLayers: distanceBands.map((band, index) => ({
      ...band,
      obstructionAnglesCentidegrees: new Int16Array(
        samples.map((sample) => Math.round(sample * (1 - index * 0.3))),
      ),
    })),
    obstructionAnglesCentidegrees: new Int16Array(samples),
    source: {
      id: 'etopo',
      title: 'ETOPO fixture',
      productUrl: 'https://example.com/product',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      sampleStepMeters: 1_852,
      azimuthStepDegrees,
      distanceBands,
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
  };
}
