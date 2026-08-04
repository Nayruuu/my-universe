export interface CosmicWebVolume {
  readonly resolution: number;
  readonly halfExtentMpc: number;
  readonly referenceEpochJulianDay: number;
  readonly sourceGroupCount: number;
  readonly sourceEdgeCount: number;
  readonly density: Uint8Array;
}

export const COSMIC_WEB_VOLUME_MAGIC = 'UMCV';
export const COSMIC_WEB_VOLUME_VERSION = 1;
export const COSMIC_WEB_VOLUME_HEADER_BYTES = 64;

const EQUATORIAL_CARTESIAN_FRAME = 1;
const MINIMUM_RESOLUTION = 4;
const MAXIMUM_RESOLUTION = 256;
const CHANNEL_COUNT = 1;
const MAXIMUM_EDGES_PER_GROUP = 2;

export function parseCosmicWebVolume(buffer: ArrayBuffer): CosmicWebVolume {
  if (buffer.byteLength < COSMIC_WEB_VOLUME_HEADER_BYTES) {
    throw invalidVolume('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  const version = view.getUint16(4, true);
  const headerBytes = view.getUint16(6, true);
  const resolution = view.getUint16(8, true);
  const channelCount = view.getUint16(10, true);
  const voxelCount = view.getUint32(12, true);
  const halfExtentMpc = view.getFloat32(16, true);
  const coordinateFrame = view.getUint32(20, true);
  const referenceEpochJulianDay = view.getFloat64(24, true);
  const sourceGroupCount = view.getUint32(32, true);
  const sourceEdgeCount = view.getUint32(36, true);
  const flags = view.getUint32(40, true);

  if (version !== COSMIC_WEB_VOLUME_VERSION) {
    throw invalidVolume(`version non prise en charge (${version})`);
  }
  if (headerBytes !== COSMIC_WEB_VOLUME_HEADER_BYTES) {
    throw invalidVolume('dimensions incompatibles');
  }
  if (resolution < MINIMUM_RESOLUTION || resolution > MAXIMUM_RESOLUTION) {
    throw invalidVolume(`résolution hors limites (${resolution})`);
  }
  if (channelCount !== CHANNEL_COUNT) {
    throw invalidVolume(`nombre de canaux incompatible (${channelCount})`);
  }
  const expectedVoxelCount = resolution ** 3;

  if (voxelCount !== expectedVoxelCount) {
    throw invalidVolume(`nombre de voxels incohérent (${voxelCount})`);
  }
  if (!Number.isFinite(halfExtentMpc) || halfExtentMpc <= 0) {
    throw invalidVolume('étendue invalide');
  }
  if (coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME) {
    throw invalidVolume(`référentiel inconnu (${coordinateFrame})`);
  }
  if (!Number.isFinite(referenceEpochJulianDay)) {
    throw invalidVolume('époque de référence invalide');
  }
  if (sourceGroupCount === 0) {
    throw invalidVolume('catalogue source vide');
  }
  if (sourceEdgeCount > sourceGroupCount * MAXIMUM_EDGES_PER_GROUP) {
    throw invalidVolume(`nombre de liens incohérent (${sourceEdgeCount})`);
  }
  if (flags !== 0) {
    throw invalidVolume(`options non prises en charge (${flags})`);
  }
  const expectedBytes = COSMIC_WEB_VOLUME_HEADER_BYTES + expectedVoxelCount;

  if (buffer.byteLength !== expectedBytes) {
    throw invalidVolume(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${expectedBytes})`,
    );
  }

  return {
    resolution,
    halfExtentMpc,
    referenceEpochJulianDay,
    sourceGroupCount,
    sourceEdgeCount,
    density: new Uint8Array(buffer, COSMIC_WEB_VOLUME_HEADER_BYTES, expectedVoxelCount),
  };
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < COSMIC_WEB_VOLUME_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== COSMIC_WEB_VOLUME_MAGIC.charCodeAt(index)) {
      throw invalidVolume('signature inconnue');
    }
  }
}

function invalidVolume(reason: string): Error {
  return new Error(`Volume du réseau cosmique invalide : ${reason}.`);
}
