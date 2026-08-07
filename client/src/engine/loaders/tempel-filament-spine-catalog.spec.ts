import {
  TEMPEL_FILAMENT_SPINE_HEADER_BYTES,
  TEMPEL_FILAMENT_SPINE_INDEX_BYTES,
  TEMPEL_FILAMENT_SPINE_MAGIC,
  TEMPEL_FILAMENT_SPINE_POINT_BYTES,
  TEMPEL_FILAMENT_SPINE_VERSION,
  loadTempelFilamentSpineCatalog,
  loadTempelFilamentSpineCatalogWithMetrics,
  parseTempelFilamentSpineCatalog,
} from './tempel-filament-spine-catalog';

describe('parseTempelFilamentSpineCatalog', () => {
  it('décode les épines Tempel et leurs métriques publiées', () => {
    const catalog = parseTempelFilamentSpineCatalog(spineBuffer());

    expect(catalog.filamentCount).toBe(2);
    expect(catalog.pointCount).toBe(4);
    expect(catalog.segmentCount).toBe(2);
    expect(catalog.referenceEpochJulianDay).toBe(2_451_545);
    expect(catalog.filamentIds).toEqual(new Uint16Array([1, 2]));
    expect(catalog.pointOffsets).toEqual(new Uint32Array([0, 2, 4]));
    expect(catalog.positionsMpc[0]).toBeCloseTo(10, 6);
    expect(catalog.positionsMpc.at(-3)).toBeCloseTo(-21, 6);
    expect(catalog.visitMap).toEqual(new Uint8Array([64, 96, 128, 160]));
    expect(catalog.density).toEqual(new Uint8Array([80, 112, 144, 176]));
    expect(catalog.orientationStrength).toEqual(new Uint8Array([200, 210, 220, 230]));
    expect(catalog.minimumDistanceMpc).toBe(10);
    expect(catalog.maximumDistanceMpc).toBe(21);
  });

  it.each([
    ['en-tête tronqué', new ArrayBuffer(12)],
    ['signature inconnue', spineBuffer({ magic: 'NOPE' })],
    ['version non prise en charge', spineBuffer({ version: 2 })],
    ['dimensions incompatibles', spineBuffer({ headerBytes: 48 })],
    ['dimensions incompatibles', spineBuffer({ pointBytes: 12 })],
    ['dimensions incompatibles', spineBuffer({ indexBytes: 4 })],
    ['nombre de filaments hors limites', spineBuffer({ filamentCount: 0 })],
    ['nombre de points hors limites', spineBuffer({ pointCount: 2 })],
    ['nombre de segments incohérent', spineBuffer({ segmentCount: 3 })],
    ['référentiel inconnu', spineBuffer({ coordinateFrame: 2 })],
    ['unité inconnue', spineBuffer({ distanceUnit: 2 })],
    ['époque de référence invalide', spineBuffer({ referenceEpochJulianDay: Number.NaN })],
    ['limites de distance invalides', spineBuffer({ minimumDistanceMpc: 0 })],
    ['limites de distance invalides', spineBuffer({ maximumDistanceMpc: 5 })],
    ['métriques incompatibles', spineBuffer({ metricFlags: 1 })],
    ['taille inattendue', spineBuffer({ truncatePayload: true })],
  ])('rejette un catalogue invalide : %s', (message, buffer) => {
    expect(() => parseTempelFilamentSpineCatalog(buffer)).toThrow(message);
  });

  it('rejette un index de filament invalide ou non contigu', () => {
    const zeroId = spineBuffer();
    const duplicateId = spineBuffer();
    const shortFilament = spineBuffer();
    const brokenOffset = spineBuffer();
    const finalOffset = spineBuffer();
    const firstIndex = TEMPEL_FILAMENT_SPINE_HEADER_BYTES;
    const secondIndex = firstIndex + TEMPEL_FILAMENT_SPINE_INDEX_BYTES;

    new DataView(zeroId).setUint16(firstIndex, 0, true);
    new DataView(duplicateId).setUint16(secondIndex, 1, true);
    new DataView(shortFilament).setUint16(firstIndex + 2, 1, true);
    new DataView(brokenOffset).setUint32(secondIndex + 4, 1, true);
    new DataView(finalOffset).setUint16(secondIndex + 2, 3, true);

    expect(() => parseTempelFilamentSpineCatalog(zeroId)).toThrow(/index de filament invalide/);
    expect(() => parseTempelFilamentSpineCatalog(duplicateId)).toThrow(
      /index de filament invalide/,
    );
    expect(() => parseTempelFilamentSpineCatalog(shortFilament)).toThrow(
      /index de filament invalide/,
    );
    expect(() => parseTempelFilamentSpineCatalog(brokenOffset)).toThrow(
      /index de filament non contigu/,
    );
    expect(() => parseTempelFilamentSpineCatalog(finalOffset)).toThrow(
      /index de filament hors limites/,
    );

    const unusedPoint = new ArrayBuffer(
      spineBuffer().byteLength + TEMPEL_FILAMENT_SPINE_POINT_BYTES,
    );
    const unusedPointBytes = new Uint8Array(unusedPoint);

    unusedPointBytes.set(new Uint8Array(spineBuffer()));
    const unusedPointView = new DataView(unusedPoint);

    unusedPointView.setUint32(16, 5, true);
    unusedPointView.setUint32(20, 3, true);
    const unusedPointOffset = unusedPoint.byteLength - TEMPEL_FILAMENT_SPINE_POINT_BYTES;

    unusedPointView.setFloat32(unusedPointOffset, 12, true);
    expect(() => parseTempelFilamentSpineCatalog(unusedPoint)).toThrow(
      /index de filament hors limites/,
    );
  });

  it('rejette un point non physique et des bornes mensongères', () => {
    const invalidCoordinate = spineBuffer();
    const zeroPosition = spineBuffer();
    const invalidBounds = spineBuffer();
    const pointOffset = TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 2 * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;

    new DataView(invalidCoordinate).setFloat32(pointOffset, Number.NaN, true);
    new DataView(zeroPosition).setFloat32(pointOffset, 0, true);
    new DataView(invalidBounds).setFloat32(36, 11, true);

    expect(() => parseTempelFilamentSpineCatalog(invalidCoordinate)).toThrow(/point invalide/);
    expect(() => parseTempelFilamentSpineCatalog(zeroPosition)).toThrow(/point invalide/);
    expect(() => parseTempelFilamentSpineCatalog(invalidBounds)).toThrow(
      /bornes du catalogue incohérentes/,
    );
  });
});

describe('loadTempelFilamentSpineCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('télécharge et valide la source statique à la demande', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => spineBuffer(),
    }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loadTempelFilamentSpineCatalog({ id: 'tempel-spines', url: '/spines.bin' }),
    ).resolves.toMatchObject({ filamentCount: 2, segmentCount: 2 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/spines.bin');
  });

  it('distingue le téléchargement du décodage avec une horloge monotone injectée', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => spineBuffer(),
    }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loadTempelFilamentSpineCatalogWithMetrics(
        { id: 'tempel-spines', url: '/spines.bin' },
        clock(10, 34, 39),
      ),
    ).resolves.toMatchObject({
      catalog: { filamentCount: 2, segmentCount: 2 },
      metrics: { fetchMs: 24, decodeMs: 5 },
    });
  });

  it('produit une erreur explicite si la source différée est indisponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    await expect(
      loadTempelFilamentSpineCatalog({ id: 'tempel-spines', url: '/spines.bin' }),
    ).rejects.toThrow('Impossible de charger tempel-spines (503)');
  });
});

function clock(...values: number[]): () => number {
  return () => values.shift()!;
}

interface SpineBufferOptions {
  readonly magic?: string;
  readonly version?: number;
  readonly headerBytes?: number;
  readonly pointBytes?: number;
  readonly indexBytes?: number;
  readonly filamentCount?: number;
  readonly pointCount?: number;
  readonly segmentCount?: number;
  readonly coordinateFrame?: number;
  readonly distanceUnit?: number;
  readonly referenceEpochJulianDay?: number;
  readonly minimumDistanceMpc?: number;
  readonly maximumDistanceMpc?: number;
  readonly metricFlags?: number;
  readonly truncatePayload?: boolean;
}

function spineBuffer(options: SpineBufferOptions = {}): ArrayBuffer {
  const physicalFilamentCount = 2;
  const physicalPointCount = 4;
  const fullLength =
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES +
    physicalFilamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES +
    physicalPointCount * TEMPEL_FILAMENT_SPINE_POINT_BYTES;
  const buffer = new ArrayBuffer(fullLength - Number(options.truncatePayload ?? false));
  const view = new DataView(buffer);
  const magic = options.magic ?? TEMPEL_FILAMENT_SPINE_MAGIC;

  for (let index = 0; index < magic.length; index += 1) {
    view.setUint8(index, magic.charCodeAt(index));
  }
  view.setUint16(4, options.version ?? TEMPEL_FILAMENT_SPINE_VERSION, true);
  view.setUint16(6, options.headerBytes ?? TEMPEL_FILAMENT_SPINE_HEADER_BYTES, true);
  view.setUint16(8, options.pointBytes ?? TEMPEL_FILAMENT_SPINE_POINT_BYTES, true);
  view.setUint16(10, options.indexBytes ?? TEMPEL_FILAMENT_SPINE_INDEX_BYTES, true);
  view.setUint32(12, options.filamentCount ?? physicalFilamentCount, true);
  view.setUint32(16, options.pointCount ?? physicalPointCount, true);
  view.setUint32(20, options.segmentCount ?? 2, true);
  view.setUint16(24, options.coordinateFrame ?? 1, true);
  view.setUint16(26, options.distanceUnit ?? 1, true);
  view.setFloat64(28, options.referenceEpochJulianDay ?? 2_451_545, true);
  view.setFloat32(36, options.minimumDistanceMpc ?? 10, true);
  view.setFloat32(40, options.maximumDistanceMpc ?? 21, true);
  view.setUint32(44, options.metricFlags ?? 0x7, true);

  const indexOffset = TEMPEL_FILAMENT_SPINE_HEADER_BYTES;

  view.setUint16(indexOffset, 1, true);
  view.setUint16(indexOffset + 2, 2, true);
  view.setUint32(indexOffset + 4, 0, true);
  view.setUint16(indexOffset + TEMPEL_FILAMENT_SPINE_INDEX_BYTES, 2, true);
  view.setUint16(indexOffset + TEMPEL_FILAMENT_SPINE_INDEX_BYTES + 2, 2, true);
  view.setUint32(indexOffset + TEMPEL_FILAMENT_SPINE_INDEX_BYTES + 4, 2, true);
  const pointsOffset = indexOffset + physicalFilamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;
  const positions = [10, 11, -20, -21];

  for (let pointIndex = 0; pointIndex < physicalPointCount; pointIndex += 1) {
    const offset = pointsOffset + pointIndex * TEMPEL_FILAMENT_SPINE_POINT_BYTES;

    view.setFloat32(offset, positions[pointIndex]!, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);
    view.setUint8(offset + 12, 64 + pointIndex * 32);
    view.setUint8(offset + 13, 80 + pointIndex * 32);
    view.setUint8(offset + 14, 200 + pointIndex * 10);
  }

  return buffer;
}
