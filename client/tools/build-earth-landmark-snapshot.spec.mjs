import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  assertLandmarkSnapshotQuality,
  buildLandmarkSnapshot,
  classifyCandidate,
  createPeripheralWikipediaSearchOrigins,
  createRuntimeArtifacts,
  createWikipediaGeosearchUrl,
  createWikipediaPageViewUrl,
  formatLandmarkJson,
  landmarkFactCandidateIds,
  landmarkPageViewCandidateIds,
  landmarkCandidateImportanceScore,
  mergeWikipediaPageViewResponse,
  parseEarthObserverLocationSource,
  parseWikidataEndedEntityIds,
  parseWikidataHeightFacts,
  requiresPeripheralWikipediaSearches,
  serializeLandmarkJson,
  selectLandmarks,
  validateLandmarkSnapshot,
  wikipediaPageViewCount,
} from './build-earth-landmark-snapshot.mjs';

const PARIS = {
  id: 'paris',
  name: 'Paris',
  countryCode: 'FR',
  latitude: 48.8566,
  longitude: 2.3522,
  timeZone: 'Europe/Paris',
  population: 2_138_551,
  capital: true,
};

test('parses the generated Earth observer catalogue without evaluating TypeScript', () => {
  const source = `
    export type Ignored = string;
    export const EARTH_OBSERVER_LOCATION_RECORDS = [
      ['paris', 'Paris', 'FR', 48.8566, 2.3522, 'Europe/Paris', 2138551, 1],
      ['geonames-5128581', 'New York City', 'US', 40.71427, -74.00597, 'America/New_York', 8804190, 0],
    ] as const satisfies readonly unknown[];
  `;

  assert.deepEqual(parseEarthObserverLocationSource(source), [
    PARIS,
    {
      id: 'geonames-5128581',
      name: 'New York City',
      countryCode: 'US',
      latitude: 40.71427,
      longitude: -74.00597,
      timeZone: 'America/New_York',
      population: 8_804_190,
      capital: false,
    },
  ]);
  assert.throws(
    () => parseEarthObserverLocationSource('export const nope = [];'),
    /EARTH_OBSERVER_LOCATION_RECORDS/,
  );
});

test('classifies physical landmarks and rejects non-place articles', () => {
  assert.equal(
    classifyCandidate(candidate('Eiffel Tower', 'wrought-iron lattice tower in Paris')),
    'tower',
  );
  assert.equal(
    classifyCandidate(candidate('Brooklyn Bridge', 'bridge in New York City')),
    'bridge',
  );
  assert.equal(classifyCandidate(candidate('Louvre', 'art museum in Paris, France')), 'museum');
  assert.equal(
    classifyCandidate(candidate('City Hall station', 'railway station in New York City')),
    'transport',
  );
  assert.equal(
    classifyCandidate(candidate('Westminster station', 'London Underground station')),
    'transport',
  );
  assert.equal(
    classifyCandidate(candidate('Convention Pavilion', 'public building in the capital')),
    'civic',
  );
  assert.equal(
    classifyCandidate(candidate('Paris Commune', '1871 revolutionary city council in France')),
    null,
  );
  assert.equal(
    classifyCandidate(candidate('Old Tower', 'demolished tower formerly in the city')),
    null,
  );
  assert.equal(classifyCandidate(candidate('Old Bastille', 'former fortress in the city')), null);
  assert.equal(
    classifyCandidate(candidate('Garissa University College attack', '2015 incident in Kenya')),
    null,
  );
  assert.equal(
    classifyCandidate(candidate('2013 Rosario gas explosion', 'urban incident in Argentina')),
    null,
  );
  assert.equal(
    classifyCandidate(
      candidate('Bardo National Museum attack', '2015 terrorist attack in Tunis, Tunisia'),
    ),
    null,
  );
  assert.equal(
    classifyCandidate(candidate('1942 Abdeen Palace incident', 'political incident in Cairo')),
    null,
  );
  assert.equal(
    classifyCandidate(
      candidate('2024 Mumbai crowd crush', 'fatal crowd crush outside a railway station'),
    ),
    null,
  );
  assert.equal(classifyCandidate(candidate('2LO', 'radio station in London')), null);
  assert.equal(
    classifyCandidate(candidate('Bombing Victims Memorial', 'physical monument in the city')),
    'monument',
  );
});

test('covers saturated city centers with four deterministic peripheral searches', () => {
  const origins = createPeripheralWikipediaSearchOrigins({ ...PARIS, population: 750_000 });

  assert.equal(origins.length, 4);
  assert.equal(
    new Set(origins.map(({ latitude, longitude }) => `${latitude},${longitude}`)).size,
    4,
  );
  assert.ok(
    origins.every((origin) => Math.abs(greatCircleDistanceMeters(PARIS, origin) - 4_500) < 2),
  );
  assert.ok(origins.every(({ radiusMeters }) => radiusMeters === 5_500));
});

test('covers the full footprint of saturated megacities with eight wide searches', () => {
  const mumbai = {
    id: 'geonames-1275339',
    name: 'Mumbai',
    countryCode: 'IN',
    latitude: 19.07283,
    longitude: 72.88261,
    timeZone: 'Asia/Kolkata',
    population: 12_691_836,
    capital: false,
  };
  const origins = createPeripheralWikipediaSearchOrigins(mumbai);

  assert.equal(origins.length, 8);
  assert.equal(
    new Set(origins.map(({ latitude, longitude }) => `${latitude},${longitude}`)).size,
    8,
  );
  assert.ok(
    origins.every((origin) => Math.abs(greatCircleDistanceMeters(mumbai, origin) - 12_000) < 2),
  );
  assert.ok(origins.every(({ radiusMeters }) => radiusMeters === 10_000));
  assert.equal(requiresPeripheralWikipediaSearches(mumbai, 312), true);
  assert.equal(requiresPeripheralWikipediaSearches({ ...PARIS, population: 750_000 }, 312), false);
  assert.equal(requiresPeripheralWikipediaSearches({ ...PARIS, population: 750_000 }, 500), true);
});

test('keeps geosearch focused on coordinates and requests page views through a paginated query', () => {
  const url = new URL(createWikipediaGeosearchUrl(PARIS, 10_000));

  assert.equal(url.searchParams.get('ggslimit'), '500');
  assert.equal(url.searchParams.get('colimit'), 'max');
  assert.equal(url.searchParams.get('ggsradius'), '10000');
  assert.doesNotMatch(url.searchParams.get('prop'), /pageviews/u);
  assert.equal(url.searchParams.has('pvipdays'), false);
  assert.equal(url.searchParams.has('ggscontinue'), false);
  const pageViewUrl = new URL(createWikipediaPageViewUrl([42, 84], 'Continuation title'));

  assert.equal(pageViewUrl.searchParams.get('pageids'), '42|84');
  assert.equal(pageViewUrl.searchParams.get('prop'), 'pageviews');
  assert.equal(pageViewUrl.searchParams.get('pvipdays'), '60');
  assert.equal(pageViewUrl.searchParams.get('pvipcontinue'), 'Continuation title');
  assert.equal(wikipediaPageViewCount({ '2026-08-16': 120, '2026-08-17': null }), 120);
  assert.equal(wikipediaPageViewCount(undefined), 0);
});

test('does not erase page views already collected when a continuation omits that page', () => {
  const counts = new Map([
    [42, 1_250],
    [84, 0],
  ]);

  mergeWikipediaPageViewResponse(counts, {
    query: {
      pages: [{ pageid: 42 }, { pageid: 84, pageviews: { '2026-08-18': 300, '2026-08-19': 250 } }],
    },
  });

  assert.deepEqual(
    counts,
    new Map([
      [42, 1_250],
      [84, 550],
    ]),
  );
});

test('scores public interest strongly enough to surface an iconic building across the city', () => {
  const nearbyLocalBuilding = candidate('Nearby Academic Tower', 'university building', {
    distanceMeters: 120,
    pageLength: 42_000,
    pageViewCount: 180,
  });
  const iconicBuilding = candidate('World Landmark Tower', 'historic observation tower', {
    distanceMeters: 8_500,
    pageLength: 96_000,
    pageViewCount: 280_000,
  });

  assert.ok(
    landmarkCandidateImportanceScore(iconicBuilding, 'tower') >
      landmarkCandidateImportanceScore(nearbyLocalBuilding, 'civic'),
  );
  assert.equal(
    selectLandmarks(PARIS, [
      nearbyLocalBuilding,
      iconicBuilding,
      candidate('City Museum', 'museum'),
      candidate('Old Bridge', 'bridge'),
      candidate('Central Palace', 'palace'),
    ])[0].name,
    'World Landmark Tower',
  );
});

test('prefetches facts for a diverse shortlist and rewards documented physical heights', () => {
  const documented = candidate('Documented Tower', 'historic observation tower', {
    heightMeters: 210,
    pageLength: 42_000,
    pageViewCount: 3_000,
  });
  const unknown = candidate('Unknown Tower', 'historic observation tower', {
    pageLength: 42_000,
    pageViewCount: 3_000,
  });
  const museum = candidate('City Museum', 'museum');
  const candidatesByLocation = new Map([[PARIS.id, [documented, unknown, museum]]]);

  expectUniqueIds(landmarkFactCandidateIds(candidatesByLocation, 2), 2);
  assert.deepEqual(landmarkPageViewCandidateIds(candidatesByLocation, 2), [
    documented.wikipediaPageId,
    museum.wikipediaPageId,
  ]);
  assert.ok(
    landmarkCandidateImportanceScore(documented, 'tower') >
      landmarkCandidateImportanceScore(unknown, 'tower'),
  );
});

test('allows two iconic landmarks of one category instead of forcing a weak category', () => {
  const selected = selectLandmarks(PARIS, [
    candidate('Iconic North Tower', 'historic tower', {
      pageLength: 110_000,
      pageViewCount: 400_000,
    }),
    candidate('Iconic South Tower', 'observation tower', {
      latitude: 48.82,
      longitude: 2.35,
      pageLength: 100_000,
      pageViewCount: 320_000,
    }),
    candidate('Important Museum', 'museum', { pageLength: 65_000, pageViewCount: 90_000 }),
    candidate('Important Palace', 'palace', { pageLength: 58_000, pageViewCount: 70_000 }),
    candidate('Minor Campus', 'university campus', {
      pageLength: 1_500,
      pageViewCount: 20,
    }),
  ]);

  assert.deepEqual(
    selected.map(({ name }) => name),
    ['Iconic North Tower', 'Iconic South Tower', 'Important Palace', 'Important Museum'],
  );
});

test('selects four deterministic, diverse, documented landmarks', () => {
  const candidates = [
    candidate('Small tower', 'observation tower', { pageLength: 2000, distanceMeters: 100 }),
    candidate('Large tower', 'historic tower', { pageLength: 80000, distanceMeters: 900 }),
    candidate('City Museum', 'history museum', { pageLength: 25000, distanceMeters: 700 }),
    candidate('Old Bridge', 'stone bridge', { pageLength: 18000, distanceMeters: 400 }),
    candidate('Central Palace', 'royal palace', { pageLength: 45000, distanceMeters: 1500 }),
  ];

  const selected = selectLandmarks(PARIS, candidates);

  assert.equal(selected.length, 4);
  assert.deepEqual(
    selected.map(({ name }) => name),
    ['Large tower', 'Central Palace', 'Old Bridge', 'City Museum'],
  );
  assert.equal(new Set(selected.map(({ category }) => category)).size, 4);
  assert.ok(selected.every(({ sourceUrl }) => sourceUrl.startsWith('https://www.wikidata.org/')));
});

test('fills sparse cities with explicit GeoNames illustrative anchors', () => {
  const selected = selectLandmarks(PARIS, [
    candidate('Eiffel Tower', 'tower in Paris'),
    candidate('Louvre', 'museum in Paris'),
  ]);

  assert.equal(selected.length, 4);
  assert.deepEqual(
    selected.map(({ selectionMethod }) => selectionMethod),
    [
      'wikimedia-geosearch',
      'wikimedia-geosearch',
      'geonames-illustrative-fallback',
      'geonames-illustrative-fallback',
    ],
  );
  assert.ok(selected.slice(2).every(({ confidence }) => confidence === 'illustrative'));
  assert.notEqual(
    `${selected[2].latitude},${selected[2].longitude}`,
    `${selected[3].latitude},${selected[3].longitude}`,
  );
});

test('builds and validates a compact snapshot with exactly four entries per city', () => {
  const locations = [
    PARIS,
    {
      id: 'geonames-5128581',
      name: 'New York City',
      countryCode: 'US',
      latitude: 40.71427,
      longitude: -74.00597,
      timeZone: 'America/New_York',
    },
  ];
  const candidatesByLocation = new Map([
    [
      PARIS.id,
      [
        candidate('Eiffel Tower', 'tower in Paris'),
        candidate('Louvre', 'museum in Paris'),
        candidate('Arc de Triomphe', 'monument in Paris'),
        candidate('Notre-Dame de Paris', 'cathedral in Paris'),
      ],
    ],
    ['geonames-5128581', []],
  ]);

  const snapshot = buildLandmarkSnapshot(locations, candidatesByLocation, {
    generatedAt: '2026-08-18T00:00:00.000Z',
  });

  assert.equal(snapshot.locations.length, 2);
  assert.equal(snapshot.landmarks.length, 8);
  assert.equal(snapshot.metadata.fallbackCount, 4);
  assert.equal(snapshot.metadata.rankingPageViewDays, 60);
  assert.ok(snapshot.landmarks.every(({ importanceScore }) => Number.isFinite(importanceScore)));
  assert.ok(snapshot.landmarks.every(({ recentPageViews }) => recentPageViews >= 0));
  assert.ok(snapshot.landmarks.find(({ name }) => name === 'Eiffel Tower').importanceScore > 0);
  assert.ok(
    snapshot.landmarks
      .filter(({ selectionMethod }) => selectionMethod === 'geonames-illustrative-fallback')
      .every(
        ({ importanceScore, recentPageViews }) => importanceScore === 0 && recentPageViews === 0,
      ),
  );
  assert.doesNotThrow(() => validateLandmarkSnapshot(snapshot, locations));
  assert.throws(
    () =>
      validateLandmarkSnapshot({ ...snapshot, landmarks: snapshot.landmarks.slice(1) }, locations),
    /exactly 4 landmarks/,
  );
});

test('normalizes documented Wikidata heights and emits lazy regional runtime packs', async () => {
  const facts = parseWikidataHeightFacts({
    entities: {
      Q1: {
        id: 'Q1',
        claims: {
          P2048: [
            {
              rank: 'preferred',
              mainsnak: {
                datavalue: {
                  value: {
                    amount: '+1000',
                    unit: 'http://www.wikidata.org/entity/Q3710',
                  },
                },
              },
            },
          ],
        },
      },
    },
  });

  assert.equal(facts.get('Q1'), 304.8);
  assert.deepEqual(
    [
      ...parseWikidataEndedEntityIds({
        entities: {
          Q1: { id: 'Q1', claims: { P576: [{ rank: 'normal' }] } },
          Q2: { id: 'Q2', claims: {} },
        },
      }),
    ],
    ['Q1'],
  );

  const locations = [
    PARIS,
    {
      id: 'geonames-5128581',
      name: 'New York City',
      countryCode: 'US',
      latitude: 40.71427,
      longitude: -74.00597,
      timeZone: 'America/New_York',
    },
  ];
  const snapshot = buildLandmarkSnapshot(locations, new Map(), {
    generatedAt: '2026-08-18T00:00:00.000Z',
  });
  const { manifest, packs } = createRuntimeArtifacts(snapshot, locations);

  assert.deepEqual(manifest.locations, [
    ['paris', 'europe'],
    ['geonames-5128581', 'america'],
  ]);
  assert.deepEqual(
    manifest.packs.map(([regionId]) => regionId),
    ['america', 'europe'],
  );
  assert.ok(
    manifest.packs.every(([, url]) =>
      /^\/data\/earth-landmarks\/[a-z-]+\.json\?v=[a-f0-9]{12}$/u.test(url),
    ),
  );
  for (const [regionId, url] of manifest.packs) {
    const expectedHash = createHash('sha256')
      .update(serializeLandmarkJson(packs.get(regionId)))
      .digest('hex')
      .slice(0, 12);

    assert.equal(url, `/data/earth-landmarks/${regionId}.json?v=${expectedHash}`);
  }
  const rebuiltArtifacts = createRuntimeArtifacts(snapshot, locations);

  assert.deepEqual(rebuiltArtifacts, { manifest, packs });
  assert.ok(serializeLandmarkJson(manifest).includes('\n  "packs": [\n'));
  assert.ok((await formatLandmarkJson(manifest)).includes('["paris", "europe"]'));
  assert.equal(packs.get('europe').locations[0][1].length, 4);
  assert.ok(packs.get('europe').locations[0][1].every((tuple) => tuple.length === 15));
  assert.ok(
    packs
      .get('europe')
      .locations[0][1].every((tuple) => tuple[3] === 'illustrative-cityscape-anchor'),
  );
  assert.equal(packs.get('europe').locations[0][1][0][10], 'illustrative');
});

test('rejects a production snapshot with suspiciously missing heights or excessive fallbacks', () => {
  const snapshot = buildLandmarkSnapshot([PARIS], new Map(), {
    generatedAt: '2026-08-18T00:00:00.000Z',
  });

  assert.throws(
    () =>
      assertLandmarkSnapshotQuality(snapshot, {
        minimumDocumentedHeightCount: 1,
        maximumFallbackCount: 4,
      }),
    /documented heights/,
  );
  assert.throws(
    () =>
      assertLandmarkSnapshotQuality(snapshot, {
        minimumDocumentedHeightCount: 0,
        maximumFallbackCount: 3,
      }),
    /illustrative fallbacks/,
  );

  const eventSnapshot = {
    ...snapshot,
    landmarks: snapshot.landmarks.map((landmark, index) =>
      index === 0
        ? {
            ...landmark,
            name: '2024 Mumbai crowd crush',
            selectionMethod: 'wikimedia-geosearch',
          }
        : landmark,
    ),
  };

  assert.throws(
    () =>
      assertLandmarkSnapshotQuality(eventSnapshot, {
        minimumDocumentedHeightCount: 0,
        maximumFallbackCount: 4,
      }),
    /non-place articles/,
  );
});

function expectUniqueIds(ids, expectedLength) {
  assert.equal(ids.length, expectedLength);
  assert.equal(new Set(ids).size, expectedLength);
  assert.ok(ids.every((id) => /^Q\d+$/u.test(id)));
}

function candidate(name, description, overrides = {}) {
  return {
    wikidataId: `Q${Math.abs(hash(name))}`,
    name,
    description,
    latitude: 48.86,
    longitude: 2.35,
    distanceMeters: 500,
    pageLength: 10000,
    pageViewCount: 0,
    wikipediaPageId: Math.abs(hash(`${name}:page`)),
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`,
    ...overrides,
  };
}

function hash(value) {
  let result = 0;
  for (const character of value) {
    result = (result * 31 + character.codePointAt(0)) % 1_000_000;
  }
  return result + 1;
}

function greatCircleDistanceMeters(first, second) {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}
