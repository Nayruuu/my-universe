import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  EarthTerrainHorizonCatalog,
  earthTerrainObstructionDegrees,
  isEarthTerrainObstructed,
  loadEarthTerrainHorizonCatalog,
} from './earth-terrain-horizon-catalog';
import type {
  EarthTerrainHorizonManifest,
  EarthTerrainHorizonProfile,
} from './earth-terrain-horizon-catalog.types';

describe('Earth terrain horizon catalog', () => {
  it('resolves profiles only when the catalogued coordinates still match', () => {
    const samples = new Int16Array(1_080);

    samples[0] = 125;
    const catalog = new EarthTerrainHorizonCatalog(manifest(), samples);

    expect(catalog.profile(paris())?.obstructionAnglesCentidegrees[0]).toBe(125);
    expect(catalog.profile({ ...paris(), latitude: 49 })).toBeNull();
    expect(catalog.profile({ ...paris(), longitude: 3 })).toBeNull();
    expect(catalog.profile({ ...paris(), id: 'unknown' })).toBeNull();
  });

  it('interpolates circular centidegree samples without overshooting measured extrema', () => {
    const profile = terrainProfile([100, 300, 500, 700], 90);

    expect(earthTerrainObstructionDegrees(profile, 0)).toBe(1);
    expect(earthTerrainObstructionDegrees(profile, 45)).toBe(1.75);
    expect(earthTerrainObstructionDegrees(profile, 90)).toBe(3);
    expect(earthTerrainObstructionDegrees(profile, -45)).toBe(4);
    expect(earthTerrainObstructionDegrees(profile, 405)).toBe(1.75);
    expect(earthTerrainObstructionDegrees(terrainProfile([100, 100, 500, 700], 90), 45)).toBe(1);
  });

  it('classifies terrain obstruction from the same interpolated ridge used by the renderer', () => {
    const profile = terrainProfile([100, 300, 500, 700], 90);

    expect(isEarthTerrainObstructed(profile, 1.75, 45)).toBe(true);
    expect(isEarthTerrainObstructed(profile, 1.76, 45)).toBe(false);
    expect(() => earthTerrainObstructionDegrees(profile, Number.NaN)).toThrow(/azimuth/u);
  });

  it('loads, verifies and parses the manifest and its sibling binary', async () => {
    const binary = binaryBuffer([125, ...new Array<number>(1_079).fill(0)]);
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested.push(String(input));

      return requested.length === 1
        ? Response.json(manifest())
        : new Response(binary, { status: 200 });
    });
    const catalog = await loadEarthTerrainHorizonCatalog(
      '/data/earth-terrain-horizons/etopo-2022-60s.json',
      fetcher,
      async () => 'a'.repeat(64),
    );

    expect(catalog.profile(paris())?.obstructionAnglesCentidegrees[0]).toBe(125);
    expect(requested).toEqual([
      '/data/earth-terrain-horizons/etopo-2022-60s.json',
      `${window.location.origin}/data/earth-terrain-horizons/etopo-2022-60s.bin`,
    ]);
  });

  it('uses the browser SHA-256 implementation by default', async () => {
    const binary = binaryBuffer(new Array<number>(1_080).fill(0));
    const checksum = await sha256(binary);
    const sourceManifest = manifest();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...sourceManifest,
          binary: { ...sourceManifest.binary, sha256: checksum },
        }),
      )
      .mockResolvedValueOnce(new Response(binary));

    await expect(loadEarthTerrainHorizonCatalog('/manifest.json', fetcher)).resolves.toBeInstanceOf(
      EarthTerrainHorizonCatalog,
    );
  });

  it('rejects failed requests and checksum mismatches', async () => {
    await expect(
      loadEarthTerrainHorizonCatalog(
        '/missing.json',
        async () => new Response(null, { status: 404 }),
      ),
    ).rejects.toThrow(/manifest request/u);
    await expect(
      loadEarthTerrainHorizonCatalog(
        '/manifest.json',
        vi
          .fn()
          .mockResolvedValueOnce(Response.json(manifest()))
          .mockResolvedValueOnce(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow(/binary request/u);
    await expect(
      loadEarthTerrainHorizonCatalog(
        '/manifest.json',
        vi
          .fn()
          .mockResolvedValueOnce(Response.json(manifest()))
          .mockResolvedValueOnce(new Response(binaryBuffer(new Array<number>(1_080).fill(0)))),
        async () => 'b'.repeat(64),
      ),
    ).rejects.toThrow(/checksum/u);
  });
});

export function manifest(): EarthTerrainHorizonManifest {
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

export function terrainProfile(
  samples: readonly number[],
  azimuthStepDegrees: number,
): EarthTerrainHorizonProfile {
  const sourceManifest = manifest();

  return {
    locationId: 'paris',
    latitude: 48.8566,
    longitude: 2.3522,
    observerElevationMeters: 37,
    azimuthStepDegrees,
    distanceLayers: sourceManifest.calculation.distanceBands.map((band, index) => ({
      ...band,
      obstructionAnglesCentidegrees:
        index === 0 ? new Int16Array(samples) : new Int16Array(samples.length),
    })),
    obstructionAnglesCentidegrees: new Int16Array(samples),
    source: sourceManifest.source,
    calculation: { ...sourceManifest.calculation, azimuthStepDegrees },
  };
}

function paris(): EarthObserverLocation {
  return {
    id: 'paris',
    name: 'Paris',
    countryCode: 'FR',
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: 'Europe/Paris',
  };
}

function binaryBuffer(values: readonly number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 2);
  const view = new DataView(buffer);

  values.forEach((value, index) => view.setInt16(index * 2, value, true));

  return buffer;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
