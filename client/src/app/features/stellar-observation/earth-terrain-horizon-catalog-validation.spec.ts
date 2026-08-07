import type { EarthTerrainHorizonManifest } from './earth-terrain-horizon-catalog.types';
import {
  parseEarthTerrainHorizonBinary,
  parseEarthTerrainHorizonManifest,
} from './earth-terrain-horizon-catalog-validation';

describe('Earth terrain horizon validation', () => {
  it('parses a complete manifest and little-endian obstruction samples', () => {
    const source = manifest();
    const parsed = parseEarthTerrainHorizonManifest(structuredClone(source));
    const buffer = new ArrayBuffer(2_160);
    const view = new DataView(buffer);

    view.setInt16(0, 123, true);
    view.setInt16(718, 456, true);
    const samples = parseEarthTerrainHorizonBinary(parsed, buffer);

    expect(parsed).toEqual(source);
    expect(samples[0]).toBe(123);
    expect(samples[359]).toBe(456);
  });

  it.each([
    ['schema', { schema: 'legacy' }],
    ['classification', { dataClassification: 'illustrative' }],
    ['date', { generatedAt: 'never' }],
    ['profile count', { profileCount: 2 }],
    ['zero profile count', { profileCount: 0 }],
    ['profiles array', { profiles: null }],
    ['binary encoding', { binary: { ...manifest().binary, encoding: 'float32' } }],
    ['binary checksum', { binary: { ...manifest().binary, sha256: 'nope' } }],
    ['source URL', { source: { ...manifest().source, productUrl: 'relative' } }],
    ['source resolution', { source: { ...manifest().source, resolutionArcSeconds: 0 } }],
    ['calculation model', { calculation: { ...manifest().calculation, model: 'flat' } }],
    ['azimuth step', { calculation: { ...manifest().calculation, azimuthStepDegrees: 7 } }],
    ['distance bands', { calculation: { ...manifest().calculation, distanceBands: [] } }],
    [
      'distance band shape',
      {
        calculation: {
          ...manifest().calculation,
          distanceBands: manifest().calculation.distanceBands.map((band, index) =>
            index === 1 ? { ...band, minimumDistanceMeters: 20_000 } : band,
          ),
        },
      },
    ],
    [
      'negative distance band boundary',
      {
        calculation: {
          ...manifest().calculation,
          distanceBands: manifest().calculation.distanceBands.map((band, index) =>
            index === 0 ? { ...band, minimumDistanceMeters: -1 } : band,
          ),
        },
      },
    ],
    [
      'distance band coverage',
      {
        calculation: {
          ...manifest().calculation,
          distanceBands: manifest().calculation.distanceBands.map((band, index) =>
            index === 2 ? { ...band, maximumDistanceMeters: 250_000 } : band,
          ),
        },
      },
    ],
    ['sample count', { profiles: [{ ...manifest().profiles[0], sampleCount: 42 }] }],
    ['sample offset', { profiles: [{ ...manifest().profiles[0], sampleOffset: 1 }] }],
    ['negative sample offset', { profiles: [{ ...manifest().profiles[0], sampleOffset: -1 }] }],
    ['fractional sample offset', { profiles: [{ ...manifest().profiles[0], sampleOffset: 0.5 }] }],
    ['latitude', { profiles: [{ ...manifest().profiles[0], latitude: 91 }] }],
  ])('rejects an invalid %s', (_name, override) => {
    expect(() => parseEarthTerrainHorizonManifest({ ...manifest(), ...override })).toThrow(
      /terrain horizon|azimuth|distance band/u,
    );
  });

  it('rejects duplicate locations', () => {
    const source = manifest();

    expect(() =>
      parseEarthTerrainHorizonManifest({
        ...source,
        profileCount: 2,
        binary: { ...source.binary, byteLength: 4_320 },
        profiles: [source.profiles[0], { ...source.profiles[0], sampleOffset: 1_080 }],
      }),
    ).toThrow(/Duplicate/u);
  });

  it('rejects binary length, profile length and sample range mismatches', () => {
    const source = manifest();

    expect(() => parseEarthTerrainHorizonBinary(source, new ArrayBuffer(1))).toThrow(/length/u);
    expect(() =>
      parseEarthTerrainHorizonBinary(
        { ...source, binary: { ...source.binary, byteLength: 2_158 } },
        new ArrayBuffer(2_158),
      ),
    ).toThrow(/profiles/u);
    const invalidSample = new ArrayBuffer(2_160);

    new DataView(invalidSample).setInt16(0, -1, true);
    expect(() => parseEarthTerrainHorizonBinary(source, invalidSample)).toThrow(/sample/u);
  });

  it('rejects malformed top-level values', () => {
    expect(() => parseEarthTerrainHorizonManifest(null)).toThrow(/manifest/u);
    expect(() => parseEarthTerrainHorizonManifest([])).toThrow(/manifest/u);
    expect(() =>
      parseEarthTerrainHorizonManifest({ ...manifest(), source: { ...manifest().source, id: '' } }),
    ).toThrow(/source.id/u);
    expect(() =>
      parseEarthTerrainHorizonManifest({
        ...manifest(),
        calculation: { ...manifest().calculation, earthRadiusMeters: Number.NaN },
      }),
    ).toThrow(/earthRadiusMeters/u);
    expect(() =>
      parseEarthTerrainHorizonManifest({
        ...manifest(),
        source: { ...manifest().source, productUrl: 'ftp://example.com/product' },
      }),
    ).toThrow(/productUrl/u);
    expect(
      parseEarthTerrainHorizonManifest({
        ...manifest(),
        source: { ...manifest().source, productUrl: 'http://example.com/product' },
      }).source.productUrl,
    ).toBe('http://example.com/product');
  });
});

function manifest(): EarthTerrainHorizonManifest {
  return {
    schema: 'universe-map/earth-terrain-horizons@2',
    generatedAt: '2026-08-26T00:00:00.000Z',
    dataClassification: 'calculated-from-measured-global-relief-model',
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
      azimuthStepDegrees: 1,
      distanceBands: [
        { id: 'near', minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
        { id: 'mid', minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
        { id: 'far', minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
      ],
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
    binary: {
      file: 'etopo-2022-60s.bin',
      byteLength: 2_160,
      sha256: 'a'.repeat(64),
      encoding: 'int16-le-centidegrees-distance-band-major',
    },
    profileCount: 1,
    profiles: [
      {
        locationId: 'paris',
        latitude: 48.8566,
        longitude: 2.3522,
        observerElevationMeters: 37,
        sampleOffset: 0,
        sampleCount: 360,
      },
    ],
  };
}
