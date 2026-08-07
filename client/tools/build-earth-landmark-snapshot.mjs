import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import ts from 'typescript';

const DEFAULT_INPUT = resolve('src/engine/simulation/earth-observer-locations.data.ts');
const DEFAULT_OUTPUT = resolve('data-sources/earth-landmarks/earth-landmarks.snapshot.json');
const DEFAULT_RUNTIME_DIRECTORY = resolve('public/data/earth-landmarks');
const WIKIPEDIA_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_ENDPOINT = 'https://www.wikidata.org/w/api.php';
const USER_AGENT =
  'UniverseMapLandmarkBuilder/1.0 (https://github.com/Nayruuu/my-universe; static data builder)';
const LANDMARKS_PER_LOCATION = 4;
const RANKING_PAGE_VIEW_DAYS = 60;
const PRIMARY_SEARCH_RADIUS_METERS = 10_000;
const SEARCH_RADII_METERS = [5_500, 8_000, PRIMARY_SEARCH_RADIUS_METERS];
const FACT_CANDIDATES_PER_LOCATION = 12;
const PAGE_VIEW_CANDIDATES_PER_LOCATION = 20;
const SEARCH_FOOTPRINTS = [
  { minimumPopulation: 5_000_000, bearings: 8, offsetMeters: 12_000, radiusMeters: 10_000 },
  { minimumPopulation: 1_000_000, bearings: 4, offsetMeters: 8_000, radiusMeters: 8_000 },
  { minimumPopulation: 0, bearings: 4, offsetMeters: 4_500, radiusMeters: 5_500 },
];
const CATEGORY_RULES = [
  ['palace', 12, /\b(palace|royal residence|government house|presidential residence)\b/iu],
  ['tower', 12, /\b(tower|skyscraper|high-rise|observation deck|spire)\b/iu],
  ['monument', 12, /\b(monument|memorial|statue|sculpture|triumphal arch|landmark)\b/iu],
  [
    'transport',
    8,
    /\b((?:railway|railroad|train|metro|subway|underground|transit) station|terminal|lighthouse|airport|harbou?r|port)\b/iu,
  ],
  [
    'religious',
    11,
    /\b(cathedral|church|chapel|basilica|mosque|temple|synagogue|shrine|pagoda|abbey|monastery)\b/iu,
  ],
  ['museum', 10, /\b(museum|gallery|cultural centre|cultural center|library)\b/iu],
  ['bridge', 11, /\b(bridge|viaduct|aqueduct)\b/iu],
  ['fortification', 11, /\b(castle|citadel|fort|fortress|city gate|historic gate)\b/iu],
  ['civic', 9, /\b(city hall|town hall|parliament|courthouse|government building)\b/iu],
  ['venue', 8, /\b(stadium|arena|opera house|theatre|theater|concert hall)\b/iu],
  ['public-space', 7, /\b(square|plaza|public park|botanical garden|historic site)\b/iu],
  [
    'civic',
    3,
    /\b(building|architectural structure|hotel|university|campus|market|shopping cent(?:er|re)|convention cent(?:er|re))\b/iu,
  ],
];
const REJECTED_DESCRIPTIONS =
  /\b(organization|organisation|company|person|politician|athlete|film|song|album|television|election|commune|former country|historical period|timeline|district|municipality|city in|capital of|village in|settlement|radio station|broadcasting station|prison|correctional|detention|demolished|destroyed|no longer extant|proposed|planned|cancelled|former (?:building|complex|tower|fortress|castle|church|cathedral|mosque|temple|station|palace|monument|bridge|stadium))\b/iu;
const REJECTED_EVENTS =
  /\b(battle|siege|war|conflict|event|incident|ceremony|attack|bombing|protest|riot|massacre|disaster|collapse|explosion|shooting|stampede|crowd crush|crash|accident|revolution|derailment|airstrike|assassination|earthquake|flood|cyclone|hurricane|typhoon|tornado|pandemic|outbreak)\b/iu;
const PHYSICAL_COMMEMORATION = /\b(memorial|monument)\b/iu;
const METRE_UNIT = 'http://www.wikidata.org/entity/Q11573';
const UNIT_TO_METRES = new Map([
  [METRE_UNIT, 1],
  ['http://www.wikidata.org/entity/Q3710', 0.3048],
  ['http://www.wikidata.org/entity/Q174728', 0.01],
  ['http://www.wikidata.org/entity/Q828224', 1_000],
]);

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function parseEarthObserverLocationSource(source) {
  const sourceFile = ts.createSourceFile(
    'earth-observer-locations.data.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let recordsExpression;

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === 'EARTH_OBSERVER_LOCATION_RECORDS'
      ) {
        recordsExpression = unwrapExpression(declaration.initializer);
      }
    }
  });

  if (!recordsExpression || !ts.isArrayLiteralExpression(recordsExpression)) {
    throw new Error('EARTH_OBSERVER_LOCATION_RECORDS array was not found.');
  }

  return recordsExpression.elements.map((element, index) => {
    const record = unwrapExpression(element);

    if (!record || !ts.isArrayLiteralExpression(record) || record.elements.length < 8) {
      throw new Error(`Invalid Earth observer record at index ${index}.`);
    }
    const id = stringLiteralValue(record.elements[0], index, 'id');
    const name = stringLiteralValue(record.elements[1], index, 'name');
    const countryCode = stringLiteralValue(record.elements[2], index, 'countryCode');
    const latitude = numericLiteralValue(record.elements[3], index, 'latitude');
    const longitude = numericLiteralValue(record.elements[4], index, 'longitude');
    const timeZone = stringLiteralValue(record.elements[5], index, 'timeZone');
    const population = numericLiteralValue(record.elements[6], index, 'population');
    const capital = numericLiteralValue(record.elements[7], index, 'capital') === 1;

    return { id, name, countryCode, latitude, longitude, timeZone, population, capital };
  });
}

export function classifyCandidate(candidate) {
  const text = `${candidate.name} ${candidate.description ?? ''}`;

  if (isRejectedCandidate(candidate)) {
    return null;
  }
  for (const [category, , pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) {
      return category;
    }
  }

  return null;
}

function isRejectedCandidate(candidate) {
  const text = `${candidate.name} ${candidate.description ?? ''}`;

  return (
    REJECTED_DESCRIPTIONS.test(text) ||
    (REJECTED_EVENTS.test(text) && !PHYSICAL_COMMEMORATION.test(text))
  );
}

export function selectLandmarks(location, candidates) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      category: classifyCandidate(candidate),
      bearingDegrees: initialBearingDegrees(location, candidate),
    }))
    .filter(({ category }) => category !== null);
  const selected = [];
  const selectedRankedCandidates = [];
  const usedWikidataIds = new Set();

  while (selected.length < LANDMARKS_PER_LOCATION) {
    const available = ranked.filter(({ candidate }) => !usedWikidataIds.has(candidate.wikidataId));

    if (available.length === 0) {
      break;
    }
    const best = [...available].sort((first, second) =>
      compareRankedCandidates(first, second, selectedRankedCandidates),
    )[0];

    selected.push(toLandmark(location, best));
    selectedRankedCandidates.push(best);
    usedWikidataIds.add(best.candidate.wikidataId);
  }
  while (selected.length < LANDMARKS_PER_LOCATION) {
    selected.push(createFallbackLandmark(location, selected.length));
  }

  return selected;
}

export function landmarkFactCandidateIds(
  candidatesByLocation,
  perLocationLimit = FACT_CANDIDATES_PER_LOCATION,
) {
  const ids = new Set();
  const safeLimit =
    Number.isInteger(perLocationLimit) && perLocationLimit > 0 ? perLocationLimit : 0;

  for (const candidates of candidatesByLocation.values()) {
    const ranked = rankCandidatesForEnrichment(candidates).slice(0, safeLimit);

    for (const { candidate } of ranked) {
      ids.add(candidate.wikidataId);
    }
  }

  return [...ids];
}

export function landmarkPageViewCandidateIds(
  candidatesByLocation,
  perLocationLimit = PAGE_VIEW_CANDIDATES_PER_LOCATION,
) {
  const pageIds = new Set();
  const safeLimit =
    Number.isInteger(perLocationLimit) && perLocationLimit > 0 ? perLocationLimit : 0;

  for (const candidates of candidatesByLocation.values()) {
    for (const { candidate } of diverseCandidatesForEnrichment(candidates, safeLimit)) {
      if (Number.isInteger(candidate.wikipediaPageId) && candidate.wikipediaPageId > 0) {
        pageIds.add(candidate.wikipediaPageId);
      }
    }
  }

  return [...pageIds];
}

function rankCandidatesForEnrichment(candidates) {
  return candidates
    .map((candidate) => ({ candidate, category: classifyCandidate(candidate) }))
    .filter(({ category }) => category !== null)
    .sort((first, second) => {
      const scoreDifference =
        landmarkCandidateImportanceScore(second.candidate, second.category) -
        landmarkCandidateImportanceScore(first.candidate, first.category);

      return Math.abs(scoreDifference) > 0.001
        ? scoreDifference
        : first.candidate.wikidataId.localeCompare(second.candidate.wikidataId);
    });
}

function diverseCandidatesForEnrichment(candidates, limit) {
  const ranked = rankCandidatesForEnrichment(candidates);
  const categories = [...new Set(ranked.map(({ category }) => category))];
  const selected = [];

  for (let categoryRank = 0; selected.length < limit; categoryRank += 1) {
    let added = false;

    for (const category of categories) {
      const candidate = ranked.filter((entry) => entry.category === category)[categoryRank];

      if (candidate) {
        selected.push(candidate);
        added = true;
      }
      if (selected.length === limit) {
        break;
      }
    }
    if (!added) {
      break;
    }
  }

  return selected;
}

export function buildLandmarkSnapshot(locations, candidatesByLocation, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const landmarks = locations.flatMap((location) =>
    selectLandmarks(location, candidatesByLocation.get(location.id) ?? []),
  );
  const fallbackCount = landmarks.filter(
    ({ selectionMethod }) => selectionMethod === 'geonames-illustrative-fallback',
  ).length;

  return {
    metadata: {
      format: 'universe-map-earth-landmarks',
      version: 1,
      generatedAt,
      landmarksPerLocation: LANDMARKS_PER_LOCATION,
      source: 'Wikimedia geosearch + Wikidata identifiers; GeoNames fallback anchors',
      sourceEndpoint: WIKIPEDIA_ENDPOINT,
      sourceLicense: 'Wikidata CC0; Wikipedia CC BY-SA 4.0; GeoNames CC BY 4.0',
      queryRadiiMeters: SEARCH_RADII_METERS,
      locationCount: locations.length,
      landmarkCount: landmarks.length,
      fallbackCount,
      documentedHeightCount: landmarks.filter(({ heightMeters }) => heightMeters !== null).length,
      rankingPageViewDays: RANKING_PAGE_VIEW_DAYS,
    },
    locations: locations.map(({ id, name, countryCode, timeZone }) => ({
      id,
      name,
      countryCode,
      regionId: regionIdFromTimeZone(timeZone),
    })),
    landmarks,
  };
}

export function validateLandmarkSnapshot(snapshot, locations) {
  if (
    snapshot?.metadata?.format !== 'universe-map-earth-landmarks' ||
    snapshot.metadata.version !== 1
  ) {
    throw new Error('Unsupported Earth landmark snapshot format.');
  }
  const expectedLocationIds = new Set(locations.map(({ id }) => id));
  const recordsByLocation = Map.groupBy(snapshot.landmarks ?? [], ({ locationId }) => locationId);
  const ids = new Set();

  for (const location of locations) {
    const records = recordsByLocation.get(location.id) ?? [];

    if (records.length !== LANDMARKS_PER_LOCATION) {
      throw new Error(`${location.id} must contain exactly 4 landmarks.`);
    }
    for (const record of records) {
      if (
        ids.has(record.id) ||
        !Number.isFinite(record.latitude) ||
        !Number.isFinite(record.longitude) ||
        !Number.isFinite(record.importanceScore) ||
        record.importanceScore < 0 ||
        !Number.isFinite(record.recentPageViews) ||
        record.recentPageViews < 0 ||
        record.name.length === 0 ||
        record.sourceUrl.length === 0
      ) {
        throw new Error(`Invalid or duplicate landmark record: ${record.id}.`);
      }
      ids.add(record.id);
    }
  }
  const unexpected = [...recordsByLocation.keys()].filter((id) => !expectedLocationIds.has(id));

  if (unexpected.length > 0) {
    throw new Error(`Unexpected landmark location: ${unexpected[0]}.`);
  }
  if (snapshot.landmarks.length !== locations.length * LANDMARKS_PER_LOCATION) {
    throw new Error('The landmark snapshot has an inconsistent total record count.');
  }
}

export function assertLandmarkSnapshotQuality(snapshot, options = {}) {
  const minimumDocumentedHeightCount = options.minimumDocumentedHeightCount ?? 180;
  const maximumFallbackCount = options.maximumFallbackCount ?? 150;
  const actualDocumentedHeightCount = snapshot.landmarks.filter(
    ({ heightMeters, heightConfidence }) =>
      Number.isFinite(heightMeters) && heightMeters > 0 && heightConfidence === 'documented',
  ).length;
  const actualFallbackCount = snapshot.landmarks.filter(
    ({ selectionMethod }) => selectionMethod === 'geonames-illustrative-fallback',
  ).length;
  const rejectedLandmarks = snapshot.landmarks.filter(
    ({ name, selectionMethod }) =>
      selectionMethod !== 'geonames-illustrative-fallback' &&
      isRejectedCandidate({ name, description: '' }),
  );

  if (actualDocumentedHeightCount < minimumDocumentedHeightCount) {
    throw new Error(
      `Landmark quality gate requires at least ${minimumDocumentedHeightCount} documented heights; received ${actualDocumentedHeightCount}.`,
    );
  }
  if (actualFallbackCount > maximumFallbackCount) {
    throw new Error(
      `Landmark quality gate allows at most ${maximumFallbackCount} illustrative fallbacks; received ${actualFallbackCount}.`,
    );
  }
  if (rejectedLandmarks.length > 0) {
    throw new Error(
      `Landmark quality gate rejected ${rejectedLandmarks.length} non-place articles; first: ${rejectedLandmarks[0].name}.`,
    );
  }
  if (
    snapshot.metadata.documentedHeightCount !== actualDocumentedHeightCount ||
    snapshot.metadata.fallbackCount !== actualFallbackCount
  ) {
    throw new Error('Landmark quality metadata does not match the generated records.');
  }
}

export function parseWikidataHeightFacts(response) {
  const facts = new Map();

  for (const entity of Object.values(response.entities ?? {})) {
    const claims = (entity.claims?.P2048 ?? [])
      .filter(({ rank }) => rank !== 'deprecated')
      .sort((first, second) => rankValue(second.rank) - rankValue(first.rank));
    for (const claim of claims) {
      const value = claim.mainsnak?.datavalue?.value;
      const multiplier = UNIT_TO_METRES.get(value?.unit);
      const amount = Number(value?.amount);

      if (!multiplier || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      facts.set(entity.id, Math.round(amount * multiplier * 100) / 100);
      break;
    }
  }

  return facts;
}

export function parseWikidataEndedEntityIds(response) {
  return new Set(
    Object.values(response.entities ?? {})
      .filter(({ claims }) => (claims?.P576 ?? []).some(({ rank }) => rank !== 'deprecated'))
      .map(({ id }) => id),
  );
}

export function addHeightFactsToSnapshot(snapshot, heightFacts) {
  const landmarks = snapshot.landmarks.map((landmark) => {
    const heightMeters = landmark.wikidataId
      ? (heightFacts.get(landmark.wikidataId) ?? null)
      : null;

    return heightMeters === null
      ? landmark
      : {
          ...landmark,
          heightMeters,
          heightConfidence: 'documented',
          heightSourceUrl: `${landmark.sourceUrl}#P2048`,
        };
  });

  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      documentedHeightCount: landmarks.filter(({ heightMeters }) => heightMeters !== null).length,
    },
    landmarks,
  };
}

export function createRuntimeArtifacts(snapshot, locations) {
  const landmarksByLocation = Map.groupBy(snapshot.landmarks, ({ locationId }) => locationId);
  const locationsByRegion = Map.groupBy(locations, ({ timeZone }) =>
    regionIdFromTimeZone(timeZone),
  );
  const regionIds = [...locationsByRegion.keys()].sort();
  const packs = new Map(
    regionIds.map((regionId) => [
      regionId,
      {
        version: 1,
        regionId,
        locations: locationsByRegion
          .get(regionId)
          .map((location) => [
            location.id,
            (landmarksByLocation.get(location.id) ?? []).map(toRuntimeTuple),
          ]),
      },
    ]),
  );
  const packVersions = new Map(
    [...packs].map(([regionId, pack]) => [regionId, contentVersion(pack)]),
  );
  const manifest = {
    version: 1,
    locationCount: locations.length,
    packs: regionIds.map((regionId) => [
      regionId,
      `/data/earth-landmarks/${regionId}.json?v=${packVersions.get(regionId)}`,
    ]),
    locations: locations.map(({ id, timeZone }) => [id, regionIdFromTimeZone(timeZone)]),
  };

  return { manifest, packs };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const locations = parseEarthObserverLocationSource(await readFile(options.input, 'utf8'));

  if (options.repackExisting) {
    const snapshot = JSON.parse(await readFile(options.output, 'utf8'));

    validateLandmarkSnapshot(snapshot, locations);
    assertLandmarkSnapshotQuality(snapshot, {
      minimumDocumentedHeightCount: options.skipHeights ? 0 : 180,
      maximumFallbackCount: 150,
    });
    await writeLandmarkArtifacts(snapshot, locations, options);
    console.log(`Repacked ${snapshot.landmarks.length} landmarks from ${options.output}.`);

    return;
  }
  console.log(`Discovering landmarks for ${locations.length} observer locations…`);
  const entries = await parallelMap(locations, options.concurrency, async (location, index) => {
    const candidates = await discoverCandidates(location);

    if ((index + 1) % 25 === 0 || index + 1 === locations.length) {
      console.log(`  ${index + 1}/${locations.length} locations queried`);
    }

    return [location.id, candidates];
  });
  const candidatesByLocation = new Map(entries);
  const pageViewCandidateIds = landmarkPageViewCandidateIds(candidatesByLocation);

  console.log(
    `Retrieving complete ${RANKING_PAGE_VIEW_DAYS}-day page views for ${pageViewCandidateIds.length} shortlisted Wikipedia pages…`,
  );
  applyWikipediaPageViewsToCandidates(
    candidatesByLocation,
    await fetchWikipediaPageViews(pageViewCandidateIds),
  );
  const facts = { heightFacts: new Map(), endedIds: new Set(), fetchedIds: new Set() };

  if (!options.skipHeights) {
    const factCandidateIds = landmarkFactCandidateIds(candidatesByLocation);

    console.log(
      `Retrieving optional heights and existence status for ${factCandidateIds.length} shortlisted Wikidata items…`,
    );
    mergeWikidataFacts(facts, await fetchWikidataFacts(factCandidateIds));
    applyWikidataFactsToCandidates(candidatesByLocation, facts);
  }
  let snapshot = buildLandmarkSnapshot(locations, candidatesByLocation, {
    generatedAt: options.generatedAt,
  });

  if (!options.skipHeights) {
    for (let pass = 0; pass < 3; pass += 1) {
      const wikidataIds = [
        ...new Set(
          snapshot.landmarks
            .flatMap(({ wikidataId }) => wikidataId ?? [])
            .filter((id) => !facts.fetchedIds.has(id)),
        ),
      ];

      if (wikidataIds.length > 0) {
        console.log(
          `Retrieving optional heights and existence status for ${wikidataIds.length} Wikidata items…`,
        );
        mergeWikidataFacts(facts, await fetchWikidataFacts(wikidataIds));
      }
      const selectedEndedIds = new Set(
        snapshot.landmarks
          .flatMap(({ wikidataId }) => wikidataId ?? [])
          .filter((id) => facts.endedIds.has(id)),
      );

      if (selectedEndedIds.size === 0) {
        break;
      }
      applyWikidataFactsToCandidates(candidatesByLocation, facts);
      snapshot = buildLandmarkSnapshot(locations, candidatesByLocation, {
        generatedAt: options.generatedAt,
      });
      console.log(`  Replaced ${selectedEndedIds.size} ended or demolished Wikidata items.`);
    }
    snapshot = addHeightFactsToSnapshot(snapshot, facts.heightFacts);
  }
  validateLandmarkSnapshot(snapshot, locations);
  assertLandmarkSnapshotQuality(snapshot, {
    minimumDocumentedHeightCount: options.skipHeights ? 0 : 180,
    maximumFallbackCount: 150,
  });
  await writeLandmarkArtifacts(snapshot, locations, options);
  console.log(
    `Generated ${snapshot.landmarks.length} landmarks (${snapshot.metadata.fallbackCount} illustrative fallbacks, ${snapshot.metadata.documentedHeightCount} documented heights) in ${options.output}.`,
  );
}

async function writeLandmarkArtifacts(snapshot, locations, options) {
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, await formatLandmarkJson(snapshot), 'utf8');
  await writeRuntimeArtifacts(
    createRuntimeArtifacts(snapshot, locations),
    options.runtimeDirectory,
  );
}

async function discoverCandidates(location) {
  const candidates = new Map();
  const primaryResponse = await fetchJsonWithRetry(
    createWikipediaGeosearchUrl(location, PRIMARY_SEARCH_RADIUS_METERS),
  );
  const primaryPages = primaryResponse.query?.pages ?? [];

  addNormalizedWikipediaPages(candidates, location, primaryPages);
  if (requiresPeripheralWikipediaSearches(location, primaryPages.length)) {
    for (const origin of createPeripheralWikipediaSearchOrigins(location)) {
      const response = await fetchJsonWithRetry(
        createWikipediaGeosearchUrl(origin, origin.radiusMeters),
      );

      addNormalizedWikipediaPages(candidates, location, response.query?.pages ?? []);
    }
  }

  return [...candidates.values()];
}

export function requiresPeripheralWikipediaSearches(location, primaryResultCount) {
  return primaryResultCount >= 500 || (location.population ?? 0) >= 1_000_000;
}

function addNormalizedWikipediaPages(candidates, location, pages) {
  for (const page of pages) {
    const normalized = normalizeWikipediaPage(location, page);

    if (normalized) {
      candidates.set(normalized.wikidataId, normalized);
    }
  }
}

export function createPeripheralWikipediaSearchOrigins(location) {
  const population = Number.isFinite(location.population) ? Math.max(0, location.population) : 0;
  const footprint = SEARCH_FOOTPRINTS.find(
    ({ minimumPopulation }) => population >= minimumPopulation,
  );

  return Array.from({ length: footprint.bearings }, (_, index) => {
    const coordinate = coordinateAtDistance(
      location,
      index * (360 / footprint.bearings),
      footprint.offsetMeters,
    );

    return { ...coordinate, radiusMeters: footprint.radiusMeters };
  });
}

function coordinateAtDistance(origin, bearingDegrees, distanceMeters) {
  const angularDistance = distanceMeters / 6_371_000;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (origin.latitude * Math.PI) / 180;
  const longitude = (origin.longitude * Math.PI) / 180;
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return {
    latitude: roundCoordinate((destinationLatitude * 180) / Math.PI),
    longitude: roundCoordinate(normalizeLongitude((destinationLongitude * 180) / Math.PI)),
  };
}

function normalizeWikipediaPage(location, page) {
  const coordinate = page.coordinates?.find(({ globe }) => globe === 'earth');
  const wikidataId = page.pageprops?.wikibase_item;

  if (
    !coordinate ||
    !/^Q\d+$/u.test(wikidataId ?? '') ||
    typeof page.title !== 'string' ||
    typeof page.fullurl !== 'string'
  ) {
    return null;
  }

  return {
    wikidataId,
    name: page.title,
    description: page.pageprops?.['wikibase-shortdesc'] ?? '',
    latitude: coordinate.lat,
    longitude: coordinate.lon,
    distanceMeters: greatCircleDistanceMeters(location, coordinate),
    pageLength: page.length ?? 0,
    pageViewCount: 0,
    wikipediaPageId: page.pageid,
    wikipediaUrl: page.fullurl,
  };
}

export function wikipediaPageViewCount(pageviews) {
  return Object.values(pageviews ?? {}).reduce(
    (total, value) => total + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );
}

async function fetchWikidataFacts(wikidataIds) {
  const chunks = chunk(wikidataIds, 50);
  const responses = await parallelMap(chunks, 2, async (ids) => {
    try {
      return await fetchJsonWithRetry(wikidataUrl(ids));
    } catch (error) {
      console.warn(
        `  Optional Wikidata heights skipped for ${ids[0]}…${ids.at(-1)}: ${error.message}`,
      );

      return { entities: {} };
    }
  });
  const heightFacts = new Map();
  const endedIds = new Set();
  const fetchedIds = new Set();

  for (const response of responses) {
    for (const entity of Object.values(response.entities ?? {})) {
      if (entity.id) {
        fetchedIds.add(entity.id);
      }
    }
    for (const [id, height] of parseWikidataHeightFacts(response)) {
      heightFacts.set(id, height);
    }
    for (const id of parseWikidataEndedEntityIds(response)) {
      endedIds.add(id);
    }
  }

  return { heightFacts, endedIds, fetchedIds };
}

async function fetchWikipediaPageViews(pageIds) {
  const responses = await parallelMap(chunk(pageIds, 50), 4, async (ids) => {
    const counts = new Map(ids.map((id) => [id, 0]));
    let continuation;

    do {
      const response = await fetchJsonWithRetry(createWikipediaPageViewUrl(ids, continuation));

      mergeWikipediaPageViewResponse(counts, response);
      continuation = response.continue?.pvipcontinue;
    } while (continuation);

    return counts;
  });

  return new Map(responses.flatMap((counts) => [...counts]));
}

export function mergeWikipediaPageViewResponse(counts, response) {
  for (const page of response.query?.pages ?? []) {
    if (Number.isInteger(page.pageid) && page.pageid > 0 && page.pageviews !== undefined) {
      counts.set(page.pageid, wikipediaPageViewCount(page.pageviews));
    }
  }
}

function applyWikipediaPageViewsToCandidates(candidatesByLocation, pageViews) {
  for (const [locationId, candidates] of candidatesByLocation) {
    candidatesByLocation.set(
      locationId,
      candidates.map((candidate) => ({
        ...candidate,
        pageViewCount: pageViews.get(candidate.wikipediaPageId) ?? 0,
      })),
    );
  }
}

function mergeWikidataFacts(target, source) {
  for (const [id, height] of source.heightFacts) {
    target.heightFacts.set(id, height);
  }
  for (const id of source.endedIds) {
    target.endedIds.add(id);
  }
  for (const id of source.fetchedIds) {
    target.fetchedIds.add(id);
  }
}

function applyWikidataFactsToCandidates(candidatesByLocation, facts) {
  for (const [locationId, candidates] of candidatesByLocation) {
    candidatesByLocation.set(
      locationId,
      candidates
        .filter(({ wikidataId }) => !facts.endedIds.has(wikidataId))
        .map((candidate) => {
          const heightMeters = facts.heightFacts.get(candidate.wikidataId);

          return heightMeters === undefined ? candidate : { ...candidate, heightMeters };
        }),
    );
  }
}

async function fetchJsonWithRetry(url, attempt = 0) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (response.ok) {
    const payload = await response.json();

    if (!payload.error) {
      return payload;
    }
    if (attempt < 7 && ['maxlag', 'ratelimited', 'readonly'].includes(payload.error.code)) {
      const reportedLagMilliseconds = Number(payload.error.lag) * 1_000;
      const delayMilliseconds = Math.min(
        20_000,
        Math.max(
          Number.isFinite(reportedLagMilliseconds) ? reportedLagMilliseconds + 1_000 : 0,
          1_000 * 2 ** attempt,
        ),
      );

      await delay(delayMilliseconds);

      return fetchJsonWithRetry(url, attempt + 1);
    }

    throw new Error(
      `Landmark source API error (${payload.error.code}): ${payload.error.info ?? url}`,
    );
  }
  if (attempt < 4 && [429, 500, 502, 503, 504].includes(response.status)) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMilliseconds = Number.isFinite(retryAfter) ? retryAfter * 1_000 : 500 * 2 ** attempt;

    await delay(delayMilliseconds);

    return fetchJsonWithRetry(url, attempt + 1);
  }

  throw new Error(`Landmark source request failed (${response.status}): ${url}`);
}

export function createWikipediaGeosearchUrl(location, radiusMeters) {
  const parameters = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    generator: 'geosearch',
    ggscoord: `${location.latitude}|${location.longitude}`,
    ggsradius: String(radiusMeters),
    ggslimit: '500',
    ggsnamespace: '0',
    prop: 'coordinates|pageprops|info',
    colimit: 'max',
    inprop: 'url',
  });

  return `${WIKIPEDIA_ENDPOINT}?${parameters}`;
}

export function createWikipediaPageViewUrl(pageIds, continuation) {
  const parameters = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    pageids: pageIds.join('|'),
    prop: 'pageviews',
    pvipdays: String(RANKING_PAGE_VIEW_DAYS),
  });

  if (continuation) {
    parameters.set('pvipcontinue', continuation);
  }

  return `${WIKIPEDIA_ENDPOINT}?${parameters}`;
}

function wikidataUrl(ids) {
  const parameters = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    formatversion: '2',
    maxlag: '15',
    ids: ids.join('|'),
    props: 'claims',
  });

  return `${WIKIDATA_ENDPOINT}?${parameters}`;
}

function toLandmark(location, { candidate, category }) {
  const importanceScore = landmarkCandidateImportanceScore(candidate, category);

  return {
    id: `${location.id}:${candidate.wikidataId.toLowerCase()}`,
    locationId: location.id,
    name: candidate.name,
    wikidataId: candidate.wikidataId,
    category,
    latitude: roundCoordinate(candidate.latitude),
    longitude: roundCoordinate(candidate.longitude),
    distanceMeters: Math.round(candidate.distanceMeters),
    importanceScore: Math.round(importanceScore * 100) / 100,
    recentPageViews: Math.round(Math.max(0, candidate.pageViewCount ?? 0)),
    heightMeters: candidate.heightMeters ?? null,
    heightConfidence: candidate.heightMeters ? 'documented' : 'unknown',
    confidence: 'observed',
    visualConfidence: 'illustrative',
    selectionMethod: 'wikimedia-geosearch',
    sourceTitle: `Wikidata · ${candidate.name}`,
    sourceUrl: `https://www.wikidata.org/wiki/${candidate.wikidataId}`,
    wikipediaUrl: candidate.wikipediaUrl,
  };
}

function createFallbackLandmark(location, slot) {
  const bearingRadians = ((slot * 90 + 45) * Math.PI) / 180;
  const latitudeDelta = 0.0025 * Math.cos(bearingRadians);
  const longitudeScale = Math.max(0.2, Math.cos((location.latitude * Math.PI) / 180));
  const longitudeDelta = (0.0025 * Math.sin(bearingRadians)) / longitudeScale;

  return {
    id: `${location.id}:illustrative-${slot + 1}`,
    locationId: location.id,
    name: `${location.name} skyline reference ${slot + 1}`,
    wikidataId: null,
    category: 'illustrative-cityscape-anchor',
    latitude: roundCoordinate(location.latitude + latitudeDelta),
    longitude: roundCoordinate(normalizeLongitude(location.longitude + longitudeDelta)),
    distanceMeters: 278,
    importanceScore: 0,
    recentPageViews: 0,
    heightMeters: null,
    heightConfidence: 'illustrative',
    confidence: 'illustrative',
    visualConfidence: 'illustrative',
    selectionMethod: 'geonames-illustrative-fallback',
    sourceTitle: `GeoNames · ${location.name}`,
    sourceUrl: geonamesSourceUrl(location),
    wikipediaUrl: null,
  };
}

function geonamesSourceUrl(location) {
  const match = /^geonames-(\d+)$/u.exec(location.id);

  return match
    ? `https://www.geonames.org/${match[1]}`
    : `https://www.geonames.org/search.html?q=${encodeURIComponent(location.name)}&country=${location.countryCode}`;
}

function compareRankedCandidates(first, second, selected = []) {
  const scoreDifference =
    rankedCandidateScore(second, selected) - rankedCandidateScore(first, selected);

  if (Math.abs(scoreDifference) > 0.001) {
    return scoreDifference;
  }
  const distanceDifference = first.candidate.distanceMeters - second.candidate.distanceMeters;

  return distanceDifference !== 0
    ? distanceDifference
    : first.candidate.wikidataId.localeCompare(second.candidate.wikidataId);
}

function rankedCandidateScore(rankedCandidate, selectedRankedCandidates) {
  const distancePenalty = Math.log1p(rankedCandidate.candidate.distanceMeters) * 0.28;
  const sameCategoryCount = selectedRankedCandidates.filter(
    ({ category }) => category === rankedCandidate.category,
  ).length;
  const categoryRepeatPenalty = sameCategoryCount * 6;
  const azimuthPenalty = selectedRankedCandidates.reduce((penalty, selected) => {
    const separation = angularSeparationDegrees(
      rankedCandidate.bearingDegrees,
      selected.bearingDegrees,
    );

    return Math.max(penalty, separation < 15 ? 4 : separation < 35 ? 2 : 0);
  }, 0);

  return (
    landmarkCandidateImportanceScore(rankedCandidate.candidate, rankedCandidate.category) -
    distancePenalty -
    categoryRepeatPenalty -
    azimuthPenalty
  );
}

export function landmarkCandidateImportanceScore(candidate, category) {
  const pageLength = Number.isFinite(candidate.pageLength) ? Math.max(0, candidate.pageLength) : 0;
  const pageViewCount = Number.isFinite(candidate.pageViewCount)
    ? Math.max(0, candidate.pageViewCount)
    : 0;
  const sourceBonus =
    (/^Q\d+$/u.test(candidate.wikidataId) ? 5 : 0) + (candidate.wikipediaUrl ? 2 : 0);
  const editorialNotability = Math.log10(1 + pageLength) * 8;
  const audienceNotability = Math.log10(1 + pageViewCount) * 14;
  const documentedHeightBonus =
    Number.isFinite(candidate.heightMeters) && candidate.heightMeters > 0
      ? 3 + Math.min(6, Math.log10(candidate.heightMeters + 1) * 2)
      : 0;

  return (
    categoryWeight(category) +
    sourceBonus +
    editorialNotability +
    audienceNotability +
    documentedHeightBonus
  );
}

function categoryWeight(category) {
  return CATEGORY_RULES.find(([candidate]) => candidate === category)?.[1] ?? 0;
}

function greatCircleDistanceMeters(first, second) {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (second.lat - first.latitude) * toRadians;
  const longitudeDelta = (second.lon - first.longitude) * toRadians;
  const firstLatitude = first.latitude * toRadians;
  const secondLatitude = second.lat * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function initialBearingDegrees(first, second) {
  const firstLatitude = (first.latitude * Math.PI) / 180;
  const secondLatitude = ((second.latitude ?? second.lat) * Math.PI) / 180;
  const longitudeDelta = (((second.longitude ?? second.lon) - first.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(secondLatitude);
  const x =
    Math.cos(firstLatitude) * Math.sin(secondLatitude) -
    Math.sin(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angularSeparationDegrees(first, second) {
  const difference = Math.abs(first - second) % 360;

  return Math.min(difference, 360 - difference);
}

function parseArguments(argumentsList) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    runtimeDirectory: DEFAULT_RUNTIME_DIRECTORY,
    concurrency: 6,
    generatedAt: new Date().toISOString(),
    skipHeights: false,
    repackExisting: false,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (['--skip-heights', '--repack-existing'].includes(argument)) {
      options[argument === '--skip-heights' ? 'skipHeights' : 'repackExisting'] = true;
      continue;
    }
    const value = argumentsList[index + 1];

    if (
      !value ||
      !['--input', '--output', '--runtime-directory', '--concurrency', '--generated-at'].includes(
        argument,
      )
    ) {
      throw new Error(`Unsupported or incomplete argument: ${argument}.`);
    }
    if (argument === '--concurrency') {
      options.concurrency = Number(value);
      if (
        !Number.isInteger(options.concurrency) ||
        options.concurrency < 1 ||
        options.concurrency > 12
      ) {
        throw new Error('Concurrency must be an integer between 1 and 12.');
      }
    } else if (argument === '--generated-at') {
      options.generatedAt = new Date(value).toISOString();
    } else if (argument === '--runtime-directory') {
      options.runtimeDirectory = resolve(value);
    } else {
      options[argument.slice(2)] = resolve(value);
    }
    index += 1;
  }

  return options;
}

async function parallelMap(values, concurrency, task) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;

      nextIndex += 1;
      results[index] = await task(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));

  return results;
}

function unwrapExpression(node) {
  let expression = node;

  while (
    expression &&
    (ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isParenthesizedExpression(expression))
  ) {
    expression = expression.expression;
  }

  return expression;
}

function stringLiteralValue(node, recordIndex, field) {
  const expression = unwrapExpression(node);

  if (!expression || !ts.isStringLiteralLike(expression)) {
    throw new Error(`Invalid ${field} in Earth observer record ${recordIndex}.`);
  }

  return expression.text;
}

function numericLiteralValue(node, recordIndex, field) {
  const expression = unwrapExpression(node);
  let value;

  if (expression && ts.isNumericLiteral(expression)) {
    value = Number(expression.text);
  } else if (
    expression &&
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    value = -Number(expression.operand.text);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${field} in Earth observer record ${recordIndex}.`);
  }

  return value;
}

function chunk(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

function rankValue(rank) {
  return rank === 'preferred' ? 2 : rank === 'normal' ? 1 : 0;
}

function roundCoordinate(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeLongitude(longitude) {
  return ((longitude + 540) % 360) - 180;
}

function regionIdFromTimeZone(timeZone) {
  const prefix = timeZone?.split('/')[0]?.toLowerCase();

  return [
    'africa',
    'america',
    'antarctica',
    'asia',
    'atlantic',
    'australia',
    'europe',
    'indian',
    'pacific',
  ].includes(prefix)
    ? prefix
    : 'global';
}

function toRuntimeTuple(landmark) {
  return [
    landmark.id,
    landmark.name,
    landmark.wikidataId,
    landmark.category,
    landmark.latitude,
    landmark.longitude,
    landmark.distanceMeters,
    landmark.heightMeters,
    landmark.heightConfidence,
    landmark.confidence,
    landmark.visualConfidence,
    landmark.selectionMethod,
    landmark.sourceTitle,
    landmark.sourceUrl,
    landmark.wikipediaUrl,
  ];
}

async function writeRuntimeArtifacts({ manifest, packs }, runtimeDirectory) {
  await mkdir(runtimeDirectory, { recursive: true });
  await writeFile(
    resolve(runtimeDirectory, 'manifest.json'),
    await formatLandmarkJson(manifest),
    'utf8',
  );
  await Promise.all(
    [...packs].map(([regionId, pack]) =>
      writeFile(resolve(runtimeDirectory, `${regionId}.json`), serializeLandmarkJson(pack), 'utf8'),
    ),
  );
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

export function serializeLandmarkJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatLandmarkJson(value) {
  return format(JSON.stringify(value), {
    parser: 'json',
    printWidth: 100,
  });
}

function contentVersion(value) {
  return createHash('sha256').update(serializeLandmarkJson(value)).digest('hex').slice(0, 12);
}
