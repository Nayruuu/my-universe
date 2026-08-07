import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const JPL_TEXTURES = [
  'io-jpl-voyager-galileo-1440.jpg',
  'europa-jpl-voyager-1440.jpg',
  'ganymede-jpl-voyager-1440.jpg',
  'callisto-jpl-voyager-1440.jpg',
  'phobos-jpl-viking-1440.jpg',
  'deimos-jpl-viking-1440.jpg',
  'mimas-jpl-voyager-1440.jpg',
  'enceladus-jpl-voyager-1440.jpg',
  'tethys-jpl-voyager-1440.jpg',
  'dione-jpl-voyager-1440.jpg',
  'rhea-jpl-voyager-1440.jpg',
  'iapetus-jpl-voyager-1440.jpg',
  'ariel-jpl-voyager-1440.jpg',
  'umbriel-jpl-voyager-1440.jpg',
  'titania-jpl-voyager-1440.jpg',
  'oberon-jpl-voyager-1440.jpg',
  'miranda-jpl-voyager-1440.jpg',
  'triton-jpl-voyager-1440.jpg',
];

const USGS_TEXTURES = [
  ['mercury-messenger-usgs-1024.jpg', 1024, 513],
  ['titan-cassini-1024.jpg', 1024, 512],
  ['ceres-dawn-1024.jpg', 1024, 512],
  ['vesta-dawn-1024.jpg', 1024, 512],
  ['pluto-new-horizons-1024.jpg', 1024, 512],
  ['charon-new-horizons-1024.jpg', 1024, 512],
];

const NASA_ATMOSPHERE_TEXTURES = [
  ['saturn-nasa-vtad-2048.jpg', 2048, 1024],
  ['uranus-nasa-vtad-1024.jpg', 1024, 512],
  ['neptune-nasa-vtad-1024.jpg', 1024, 512],
];

const NASA_MARTIAN_MOON_MODELS = [
  ['phobos-nasa-jpl.glb', 'Phobos'],
  ['deimos-nasa-jpl.glb', 'Déimos'],
];

const NASA_DAWN_MODELS = [
  ['ceres-nasa-vtad.glb', 'Cérès', 10_603, 20_508],
  ['vesta-nasa-vtad.glb', 'Vesta', 17_558, 34_560],
];

const OBSERVED_SURFACE_IDS = [
  'mercury',
  'phobos',
  'deimos',
  'io',
  'europa',
  'ganymede',
  'callisto',
  'mimas',
  'enceladus',
  'tethys',
  'dione',
  'rhea',
  'iapetus',
  'miranda',
  'ariel',
  'umbriel',
  'titania',
  'oberon',
  'triton',
  'titan',
  'ceres',
  'vesta',
  'pluto',
  'charon',
];

test('les mosaïques JPL embarquées conservent leur grille globale 1440 × 720', async () => {
  for (const file of JPL_TEXTURES) {
    const image = await texture(file);

    assert.deepEqual(jpegDimensions(image), { width: 1440, height: 720 }, file);
  }
});

test('les dérivés navigateur USGS conservent leur grille globale publiée', async () => {
  for (const [file, width, height] of USGS_TEXTURES) {
    const image = await texture(file);

    assert.deepEqual(jpegDimensions(image), { width, height }, file);
  }
});

test('les atlas atmosphériques NASA conservent leur projection globale 2:1', async () => {
  for (const [file, width, height] of NASA_ATMOSPHERE_TEXTURES) {
    const image = await texture(file);

    assert.deepEqual(jpegDimensions(image), { width, height }, file);
  }
});

test('le modèle NASA de Bénou est un conteneur GLB complet', async () => {
  const model = await readFile(new URL('../public/models/bennu-nasa-vtad.glb', import.meta.url));

  assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(model.readUInt32LE(8), model.length);
});

test('les modèles NASA/JPL de Phobos et Déimos embarquent forme et texture', async () => {
  for (const [file, body] of NASA_MARTIAN_MOON_MODELS) {
    const model = await readFile(new URL(`../public/models/${file}`, import.meta.url));
    const manifest = glbManifest(model);

    assert.ok((manifest.meshes?.length ?? 0) > 0, `${body}: maillage absent`);
    assert.ok((manifest.images?.length ?? 0) > 0, `${body}: texture embarquée absente`);
    assert.ok((manifest.materials?.length ?? 0) > 0, `${body}: matière absente`);
  }
});

test('les modèles NASA VTAD de Cérès et Vesta embarquent les formes Dawn texturées', async () => {
  for (const [file, body, expectedVertices, expectedTriangles] of NASA_DAWN_MODELS) {
    const model = await readFile(new URL(`../public/models/${file}`, import.meta.url));
    const manifest = glbManifest(model);
    const { vertices, triangles } = glbGeometryCounts(manifest);

    assert.equal(vertices, expectedVertices, `${body}: nombre de sommets inattendu`);
    assert.equal(triangles, expectedTriangles, `${body}: nombre de triangles inattendu`);
    assert.equal(manifest.images?.length, 2, `${body}: cartes diffuse et normale absentes`);
    assert.ok((manifest.materials?.length ?? 0) > 0, `${body}: matière absente`);
  }
});

test('le modèle OSIRIS de 67P contient la forme polygonale publiée', async () => {
  const model = await readFile(
    new URL('../public/models/67p-osiris-esa.obj', import.meta.url),
    'utf8',
  );
  const vertices = model.match(/^v\s/gmu)?.length ?? 0;
  const faces = model.match(/^f\s/gmu)?.length ?? 0;

  assert.equal(vertices, 31_456);
  assert.equal(faces, 62_908);
});

test('les fiches distinguent les surfaces observées des adaptations visuelles', async () => {
  const objects = await solarSystemObjects();

  for (const id of OBSERVED_SURFACE_IDS) {
    const object = objects.get(id);

    assert.ok(object, `objet ${id} absent des catalogues solaires`);
    assert.equal(object.metadata?.appearanceConfidence, 'observed', id);
    assert.match(object.metadata?.visualSource ?? '', /observ|mosaïque/iu, id);
  }
  assert.equal(objects.get('bennu')?.metadata?.appearanceConfidence, 'observed');
  assert.match(objects.get('bennu')?.metadata?.visualSource ?? '', /observ|NASA/iu);
  assert.equal(
    objects.get('67p-churyumov-gerasimenko')?.metadata?.appearanceConfidence,
    'illustrative',
  );
  assert.match(
    objects.get('67p-churyumov-gerasimenko')?.metadata?.visualSource ?? '',
    /forme observée.*couleur illustrative/iu,
  );
  for (const id of ['saturn', 'uranus', 'neptune']) {
    const object = objects.get(id);

    assert.equal(object?.metadata?.appearanceConfidence, 'illustrative', id);
    assert.match(object?.metadata?.visualSource ?? '', /NASA VTAD/iu, id);
  }
});

function texture(file) {
  return readFile(new URL(`../public/textures/${file}`, import.meta.url));
}

async function solarSystemObjects() {
  const files = ['system.json', 'extended.json'];
  const objects = new Map();

  for (const file of files) {
    const source = await readFile(
      new URL(`../public/data/solar-system/${file}`, import.meta.url),
      'utf8',
    );

    for (const object of JSON.parse(source).objects) {
      objects.set(object.id, object);
    }
  }

  return objects;
}

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, 'JPEG SOI marker missing');
  let offset = 2;

  while (offset < buffer.length) {
    assert.equal(buffer[offset], 0xff, `invalid JPEG marker at byte ${offset}`);
    const marker = buffer[offset + 1];

    offset += 2;
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    const length = buffer.readUInt16BE(offset);

    if (marker === 0xc0 || marker === 0xc2) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += length;
  }

  throw new Error('JPEG size marker missing');
}

function glbManifest(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF');
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, 'GLB JSON chunk missing');
  const jsonLength = buffer.readUInt32LE(12);

  return JSON.parse(
    buffer
      .subarray(20, 20 + jsonLength)
      .toString('utf8')
      .trimEnd(),
  );
}

function glbGeometryCounts(manifest) {
  const primitives = (manifest.meshes ?? []).flatMap(({ primitives = [] }) => primitives);

  return {
    vertices: primitives.reduce(
      (total, primitive) =>
        total + (manifest.accessors?.[primitive.attributes?.POSITION]?.count ?? 0),
      0,
    ),
    triangles: primitives.reduce(
      (total, primitive) => total + (manifest.accessors?.[primitive.indices]?.count ?? 0) / 3,
      0,
    ),
  };
}
