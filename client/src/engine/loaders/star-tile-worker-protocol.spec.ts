import { starClusterTilePackTransferables } from './star-tile-worker-protocol';

describe('protocole Worker des tuiles stellaires', () => {
  it('transfère sans copie les cinq tableaux de chaque tuile', () => {
    const first = tile('first');
    const second = tile('second');

    expect(
      starClusterTilePackTransferables({
        version: '4.0.0',
        sourceCatalog: 'gaia',
        referenceEpochJulianDay: 2_457_388.5,
        magnitudeBand: 'gaia-g',
        colorIndexSystem: 'gaia-bp-rp',
        tiles: [first, second],
      }),
    ).toEqual([
      first.cellCoordinates.buffer,
      first.positionsParsec.buffer,
      first.starCounts.buffer,
      first.apparentMagnitudes.buffer,
      first.colorIndices.buffer,
      second.cellCoordinates.buffer,
      second.positionsParsec.buffer,
      second.starCounts.buffer,
      second.apparentMagnitudes.buffer,
      second.colorIndices.buffer,
    ]);
  });
});

function tile(id: string) {
  return {
    id,
    version: '4.0.0',
    sourceCatalog: 'gaia',
    sourceStarCount: 1,
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel: 4,
    cellSizeParsec: 256,
    representation: 'aggregate-cell',
    clusterCount: 1,
    cellCoordinates: Int32Array.from([0, 0, 0]),
    positionsParsec: Float32Array.from([1, 2, 3]),
    starCounts: Uint32Array.from([1]),
    apparentMagnitudes: Float32Array.from([2]),
    colorIndices: Float32Array.from([0.8]),
  } as const;
}
