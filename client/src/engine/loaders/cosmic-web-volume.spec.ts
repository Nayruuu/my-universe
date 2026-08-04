import {
  COSMIC_WEB_VOLUME_HEADER_BYTES,
  COSMIC_WEB_VOLUME_MAGIC,
  COSMIC_WEB_VOLUME_VERSION,
  parseCosmicWebVolume,
} from './cosmic-web-volume';

describe('parseCosmicWebVolume', () => {
  it('décode un champ de densité cosmique auto-descriptif', () => {
    const volume = parseCosmicWebVolume(volumeBuffer());

    expect(volume.resolution).toBe(8);
    expect(volume.halfExtentMpc).toBe(800);
    expect(volume.referenceEpochJulianDay).toBe(2_451_545);
    expect(volume.sourceGroupCount).toBe(37_730);
    expect(volume.sourceEdgeCount).toBe(49_939);
    expect(volume.density).toHaveLength(8 ** 3);
    expect(volume.density[0]).toBe(0);
    expect(volume.density.at(-1)).toBe(255);
  });

  it.each([
    ['en-tête tronqué', new ArrayBuffer(12)],
    ['signature inconnue', volumeBuffer({ magic: 'NOPE' })],
    ['version non prise en charge', volumeBuffer({ version: 2 })],
    ['dimensions incompatibles', volumeBuffer({ headerBytes: 48 })],
    ['résolution hors limites', volumeBuffer({ resolution: 3 })],
    ['nombre de canaux incompatible', volumeBuffer({ channels: 2 })],
    ['nombre de voxels incohérent', volumeBuffer({ voxelCount: 7 })],
    ['étendue invalide', volumeBuffer({ halfExtentMpc: 0 })],
    ['référentiel inconnu', volumeBuffer({ coordinateFrame: 2 })],
    ['époque de référence invalide', volumeBuffer({ referenceEpochJulianDay: Number.NaN })],
    ['catalogue source vide', volumeBuffer({ sourceGroupCount: 0 })],
    ['nombre de liens incohérent', volumeBuffer({ sourceEdgeCount: 100_000 })],
    ['options non prises en charge', volumeBuffer({ flags: 1 })],
    ['taille inattendue', volumeBuffer({ truncatePayload: true })],
  ])('rejette un volume invalide : %s', (message, buffer) => {
    expect(() => parseCosmicWebVolume(buffer)).toThrow(message);
  });
});

interface VolumeBufferOptions {
  readonly magic?: string;
  readonly version?: number;
  readonly headerBytes?: number;
  readonly resolution?: number;
  readonly channels?: number;
  readonly voxelCount?: number;
  readonly halfExtentMpc?: number;
  readonly coordinateFrame?: number;
  readonly referenceEpochJulianDay?: number;
  readonly sourceGroupCount?: number;
  readonly sourceEdgeCount?: number;
  readonly flags?: number;
  readonly truncatePayload?: boolean;
}

function volumeBuffer(options: VolumeBufferOptions = {}): ArrayBuffer {
  const resolution = options.resolution ?? 8;
  const actualVoxelCount = resolution ** 3;
  const payloadLength = options.truncatePayload ? actualVoxelCount - 1 : actualVoxelCount;
  const buffer = new ArrayBuffer(COSMIC_WEB_VOLUME_HEADER_BYTES + payloadLength);
  const view = new DataView(buffer);
  const magic = options.magic ?? COSMIC_WEB_VOLUME_MAGIC;

  for (let index = 0; index < magic.length; index += 1) {
    view.setUint8(index, magic.charCodeAt(index));
  }
  view.setUint16(4, options.version ?? COSMIC_WEB_VOLUME_VERSION, true);
  view.setUint16(6, options.headerBytes ?? COSMIC_WEB_VOLUME_HEADER_BYTES, true);
  view.setUint16(8, resolution, true);
  view.setUint16(10, options.channels ?? 1, true);
  view.setUint32(12, options.voxelCount ?? actualVoxelCount, true);
  view.setFloat32(16, options.halfExtentMpc ?? 800, true);
  view.setUint32(20, options.coordinateFrame ?? 1, true);
  view.setFloat64(24, options.referenceEpochJulianDay ?? 2_451_545, true);
  view.setUint32(32, options.sourceGroupCount ?? 37_730, true);
  view.setUint32(36, options.sourceEdgeCount ?? 49_939, true);
  view.setUint32(40, options.flags ?? 0, true);
  if (!options.truncatePayload) {
    new Uint8Array(buffer, COSMIC_WEB_VOLUME_HEADER_BYTES).fill(0);
    new Uint8Array(buffer)[buffer.byteLength - 1] = 255;
  }

  return buffer;
}
