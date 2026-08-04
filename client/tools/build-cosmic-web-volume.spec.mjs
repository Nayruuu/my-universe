import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COSMIC_WEB_VOLUME_HEADER_BYTES,
  COSMIC_WEB_VOLUME_VERSION,
  buildCosmicWebDensityVolume,
  createIllustrativeCellularField,
  encodeCosmicWebVolume,
} from './build-cosmic-web-volume.mjs';

test('builds a deterministic density field with connected catalogue anchors', () => {
  const source = connectedSource();
  const options = { resolution: 9, halfExtentMpc: 4, blurPasses: 1 };
  const first = buildCosmicWebDensityVolume(source, options);
  const second = buildCosmicWebDensityVolume(source, options);
  const midpoint = voxelIndex(4, 4, 4, first.resolution);
  const corner = voxelIndex(0, 0, 0, first.resolution);

  assert.deepEqual(first, second);
  assert.equal(first.resolution, 9);
  assert.equal(first.halfExtentMpc, 4);
  assert.equal(first.sourceGroupCount, 3);
  assert.equal(first.sourceEdgeCount, 2);
  assert.equal(first.sampledEdgeCount, 1);
  assert.equal(first.density.length, 9 ** 3);
  assert.ok(first.density.filter((value) => value > 0).length < first.density.length / 2);
  assert.ok(first.density[midpoint] > first.density[corner]);
  assert.equal(Math.max(...first.density), 255);
});

test('creates a deterministic sparse cellular field across all eight cosmic octants', () => {
  const resolution = 24;
  const first = createIllustrativeCellularField(resolution, 4);
  const second = createIllustrativeCellularField(resolution, 4);
  const occupiedOctants = new Set();
  let occupiedVoxelCount = 0;

  assert.deepEqual(first, second);
  assert.equal(first.length, resolution ** 3);
  for (let z = 0; z < resolution; z += 1) {
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        if (first[voxelIndex(x, y, z, resolution)] <= 0) {
          continue;
        }
        occupiedVoxelCount += 1;
        occupiedOctants.add(
          `${x >= resolution / 2 ? 1 : 0}${y >= resolution / 2 ? 1 : 0}${z >= resolution / 2 ? 1 : 0}`,
        );
      }
    }
  }
  assert.ok(occupiedVoxelCount > first.length * 0.02);
  assert.ok(occupiedVoxelCount < first.length * 0.45);
  assert.equal(occupiedOctants.size, 8);
  assert.ok(Math.max(...first) > 0.7);
});

test('fills under-sampled outer space while preserving catalogue provenance counts', () => {
  const volume = buildCosmicWebDensityVolume(connectedSource(), {
    resolution: 24,
    halfExtentMpc: 4,
    blurPasses: 1,
  });
  const occupiedOctants = new Set();

  for (let z = 0; z < volume.resolution; z += 1) {
    for (let y = 0; y < volume.resolution; y += 1) {
      for (let x = 0; x < volume.resolution; x += 1) {
        if (volume.density[voxelIndex(x, y, z, volume.resolution)] === 0) {
          continue;
        }
        occupiedOctants.add(
          `${x >= volume.resolution / 2 ? 1 : 0}${y >= volume.resolution / 2 ? 1 : 0}${z >= volume.resolution / 2 ? 1 : 0}`,
        );
      }
    }
  }

  assert.equal(volume.sourceGroupCount, 3);
  assert.equal(volume.sourceEdgeCount, 2);
  assert.equal(volume.illustrativeCellCount, 6);
  assert.ok(volume.illustrativeVoxelCount > 0);
  assert.equal(occupiedOctants.size, 8);
});

test('compensates the radial catalogue selection bias before encoding density', () => {
  const volume = buildCosmicWebDensityVolume(
    {
      referenceEpochJulianDay: 2_451_545,
      positionsMpc: new Float32Array([0, 0, 0, 3, 0, 0]),
      distanceModulusErrors: new Float32Array([0.1, 0.1]),
      filamentPairs: new Uint32Array(),
    },
    { resolution: 9, halfExtentMpc: 4, blurPasses: 0 },
  );
  const centralDensity = volume.density[voxelIndex(4, 4, 4, 9)];
  const outerDensity = volume.density[voxelIndex(7, 4, 4, 9)];

  assert.ok(centralDensity > 0);
  assert.ok(outerDensity > centralDensity);
});

test('encodes a self-describing single-channel volume', () => {
  const volume = buildCosmicWebDensityVolume(connectedSource(), {
    resolution: 8,
    halfExtentMpc: 6,
    blurPasses: 0,
  });
  const binary = encodeCosmicWebVolume(volume);

  assert.equal(binary.toString('ascii', 0, 4), 'UMCV');
  assert.equal(binary.readUInt16LE(4), COSMIC_WEB_VOLUME_VERSION);
  assert.equal(binary.readUInt16LE(6), COSMIC_WEB_VOLUME_HEADER_BYTES);
  assert.equal(binary.readUInt16LE(8), 8);
  assert.equal(binary.readUInt16LE(10), 1);
  assert.equal(binary.readUInt32LE(12), 8 ** 3);
  assert.equal(binary.readFloatLE(16), 6);
  assert.equal(binary.readUInt32LE(32), 3);
  assert.equal(binary.readUInt32LE(36), 2);
  assert.deepEqual(binary.subarray(COSMIC_WEB_VOLUME_HEADER_BYTES), Buffer.from(volume.density));
});

test('rejects inconsistent sources and generation parameters', () => {
  const source = connectedSource();

  assert.throws(
    () => buildCosmicWebDensityVolume({ ...source, positionsMpc: new Float32Array([0]) }),
    /positions/,
  );
  assert.throws(
    () =>
      buildCosmicWebDensityVolume({
        ...source,
        distanceModulusErrors: new Float32Array([0.1]),
      }),
    /uncertainties/,
  );
  assert.throws(
    () => buildCosmicWebDensityVolume({ ...source, filamentPairs: new Uint32Array([0]) }),
    /pairs/,
  );
  assert.throws(
    () => buildCosmicWebDensityVolume(source, { resolution: 3, halfExtentMpc: 4, blurPasses: 1 }),
    /resolution/,
  );
  assert.throws(
    () => buildCosmicWebDensityVolume(source, { resolution: 8, halfExtentMpc: 0, blurPasses: 1 }),
    /extent/,
  );
  assert.throws(
    () => buildCosmicWebDensityVolume(source, { resolution: 8, halfExtentMpc: 4, blurPasses: -1 }),
    /blur/,
  );
});

function connectedSource() {
  return {
    referenceEpochJulianDay: 2_451_545,
    positionsMpc: new Float32Array([-2, 0, 0, 0, 0, 0, 2, 0, 0]),
    distanceModulusErrors: new Float32Array([0.1, 0.2, 0.1]),
    filamentPairs: new Uint32Array([0, 1, 1, 2]),
  };
}

function voxelIndex(x, y, z, resolution) {
  return x + y * resolution + z * resolution * resolution;
}
