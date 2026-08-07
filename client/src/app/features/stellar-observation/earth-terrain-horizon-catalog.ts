import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  type EarthTerrainHorizonDigest,
  type EarthTerrainHorizonFetcher,
  type EarthTerrainHorizonManifest,
  type EarthTerrainHorizonDistanceLayer,
  type EarthTerrainHorizonProfile,
} from './earth-terrain-horizon-catalog.types';
import {
  parseEarthTerrainHorizonBinary,
  parseEarthTerrainHorizonManifest,
} from './earth-terrain-horizon-catalog-validation';

const DEFAULT_MANIFEST_URL = '/data/earth-terrain-horizons/etopo-2022-60s.json';

export class EarthTerrainHorizonCatalog {
  private readonly profilesByLocationId: ReadonlyMap<string, EarthTerrainHorizonProfile>;

  constructor(
    public readonly manifest: EarthTerrainHorizonManifest,
    samples: Int16Array<ArrayBuffer>,
  ) {
    this.profilesByLocationId = new Map(
      manifest.profiles.map((profile) => {
        const distanceLayers = manifest.calculation.distanceBands.map((band, bandIndex) => ({
          ...band,
          obstructionAnglesCentidegrees: samples.slice(
            profile.sampleOffset + bandIndex * profile.sampleCount,
            profile.sampleOffset + (bandIndex + 1) * profile.sampleCount,
          ),
        }));
        const obstructionAnglesCentidegrees = maximumObstructionSamples(
          distanceLayers.map((layer) => layer.obstructionAnglesCentidegrees),
          profile.sampleCount,
        );

        return [
          profile.locationId,
          {
            locationId: profile.locationId,
            latitude: profile.latitude,
            longitude: profile.longitude,
            observerElevationMeters: profile.observerElevationMeters,
            azimuthStepDegrees: manifest.calculation.azimuthStepDegrees,
            distanceLayers,
            obstructionAnglesCentidegrees,
            source: manifest.source,
            calculation: manifest.calculation,
          },
        ] as const;
      }),
    );
  }

  public profile(location: EarthObserverLocation): EarthTerrainHorizonProfile | null {
    const profile = this.profilesByLocationId.get(location.id);

    return profile &&
      Math.abs(profile.latitude - location.latitude) <= 1e-7 &&
      Math.abs(profile.longitude - location.longitude) <= 1e-7
      ? profile
      : null;
  }
}

function maximumObstructionSamples(
  layers: readonly Int16Array<ArrayBuffer>[],
  sampleCount: number,
): Int16Array<ArrayBuffer> {
  const maximumSamples = new Int16Array(sampleCount);

  for (const layer of layers) {
    for (let index = 0; index < sampleCount; index += 1) {
      maximumSamples[index] = Math.max(maximumSamples[index]!, layer[index]!);
    }
  }

  return maximumSamples;
}

export async function loadEarthTerrainHorizonCatalog(
  manifestUrl = DEFAULT_MANIFEST_URL,
  fetcher: EarthTerrainHorizonFetcher = fetch,
  digest: EarthTerrainHorizonDigest = sha256Hex,
): Promise<EarthTerrainHorizonCatalog> {
  const manifestResponse = await fetcher(manifestUrl);

  if (!manifestResponse.ok) {
    throw new Error(`Earth terrain horizon manifest request failed (${manifestResponse.status}).`);
  }
  const manifest = parseEarthTerrainHorizonManifest(await manifestResponse.json());
  const baseUrl = new URL(manifestUrl, window.location.origin);
  const binaryUrl = new URL(manifest.binary.file, baseUrl);
  const binaryResponse = await fetcher(binaryUrl);

  if (!binaryResponse.ok) {
    throw new Error(`Earth terrain horizon binary request failed (${binaryResponse.status}).`);
  }
  const buffer = await binaryResponse.arrayBuffer();
  const checksum = await digest(buffer);

  if (checksum !== manifest.binary.sha256) {
    throw new Error('Earth terrain horizon binary checksum mismatch.');
  }

  return new EarthTerrainHorizonCatalog(manifest, parseEarthTerrainHorizonBinary(manifest, buffer));
}

export function earthTerrainObstructionDegrees(
  profile: EarthTerrainHorizonProfile,
  azimuthDegrees: number,
): number {
  return interpolateEarthTerrainObstructionDegrees(
    profile.obstructionAnglesCentidegrees,
    profile.azimuthStepDegrees,
    azimuthDegrees,
  );
}

export function earthTerrainDistanceLayerObstructionDegrees(
  profile: EarthTerrainHorizonProfile,
  layer: EarthTerrainHorizonDistanceLayer,
  azimuthDegrees: number,
): number {
  return interpolateEarthTerrainObstructionDegrees(
    layer.obstructionAnglesCentidegrees,
    profile.azimuthStepDegrees,
    azimuthDegrees,
  );
}

function interpolateEarthTerrainObstructionDegrees(
  samples: Int16Array<ArrayBuffer>,
  azimuthStepDegrees: number,
  azimuthDegrees: number,
): number {
  if (!Number.isFinite(azimuthDegrees)) {
    throw new RangeError('Earth terrain horizon azimuth must be finite.');
  }
  const normalizedAzimuth = ((azimuthDegrees % 360) + 360) % 360;
  const samplePosition = normalizedAzimuth / azimuthStepDegrees;
  const firstIndex = Math.floor(samplePosition) % samples.length;
  const secondIndex = (firstIndex + 1) % samples.length;
  const previousIndex = (firstIndex - 1 + samples.length) % samples.length;
  const followingIndex = (secondIndex + 1) % samples.length;
  const mix = samplePosition - Math.floor(samplePosition);
  const previous = samples[previousIndex]!;
  const first = samples[firstIndex]!;
  const second = samples[secondIndex]!;
  const following = samples[followingIndex]!;
  const firstTangent = monotoneTangent(first - previous, second - first);
  const secondTangent = monotoneTangent(second - first, following - second);
  const squaredMix = mix * mix;
  const cubedMix = squaredMix * mix;
  const interpolated =
    (2 * cubedMix - 3 * squaredMix + 1) * first +
    (cubedMix - 2 * squaredMix + mix) * firstTangent +
    (-2 * cubedMix + 3 * squaredMix) * second +
    (cubedMix - squaredMix) * secondTangent;

  return Math.max(Math.min(first, second), Math.min(Math.max(first, second), interpolated)) / 100;
}

function monotoneTangent(previousDelta: number, nextDelta: number): number {
  return previousDelta * nextDelta <= 0
    ? 0
    : (2 * previousDelta * nextDelta) / (previousDelta + nextDelta);
}

export function isEarthTerrainObstructed(
  profile: EarthTerrainHorizonProfile,
  geometricAltitudeDegrees: number,
  azimuthDegrees: number,
): boolean {
  return geometricAltitudeDegrees <= earthTerrainObstructionDegrees(profile, azimuthDegrees);
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
