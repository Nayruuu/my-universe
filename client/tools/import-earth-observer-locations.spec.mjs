import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEarthObserverLocationRecords,
  parseGeoNamesCities,
  parseGeoNamesCountries,
} from './import-earth-observer-locations.mjs';

test('parses GeoNames countries and populated places', () => {
  assert.deepEqual(parseGeoNamesCountries(countrySource()), [
    {
      countryCode: 'FR',
      name: 'France',
      capitalName: 'Paris',
      areaSquareKilometers: 547030,
      population: 67000000,
    },
    {
      countryCode: 'US',
      name: 'United States',
      capitalName: 'Washington',
      areaSquareKilometers: 9629091,
      population: 340000000,
    },
  ]);
  assert.deepEqual(parseGeoNamesCities(citySource())[0], {
    geonameId: 2988507,
    name: 'Paris',
    asciiName: 'Paris',
    latitude: 48.85341,
    longitude: 2.3488,
    featureCode: 'PPLC',
    countryCode: 'FR',
    population: 2138551,
    timeZone: 'Europe/Paris',
  });
});

test('builds a deterministic worldwide catalogue with the legacy French identifiers', () => {
  const records = buildEarthObserverLocationRecords(
    parseGeoNamesCountries(countrySource()),
    parseGeoNamesCities(citySource()),
  );

  assert.deepEqual(records[0], [
    'paris',
    'Paris',
    'FR',
    48.8566,
    2.3522,
    'Europe/Paris',
    2138551,
    1,
  ]);
  assert.ok(records.some(([id]) => id === 'lyon'));
  assert.ok(records.some(([id, name]) => id === 'geonames-4140963' && name === 'Washington'));
  assert.ok(records.some(([, name]) => name === 'Los Angeles'));
});

test('rejects malformed sources and catalogues without populated countries or Paris', () => {
  assert.throws(() => parseGeoNamesCountries('FR\ttoo-short'), /Invalid GeoNames countryInfo/);
  assert.throws(() => parseGeoNamesCities('1\tBroken'), /Invalid GeoNames cities500/);
  assert.throws(
    () => buildEarthObserverLocationRecords(parseGeoNamesCountries(countrySource()), []),
    /No populated place found for France/,
  );
  assert.throws(
    () =>
      buildEarthObserverLocationRecords(
        parseGeoNamesCountries(
          countryLine('US', 'United States', 'Washington', 9629091, 340000000),
        ),
        parseGeoNamesCities(
          cityLine(
            4140963,
            'Washington',
            38.89511,
            -77.03637,
            'PPLC',
            'US',
            689545,
            'America/New_York',
          ),
        ),
      ),
    /must preserve Paris/,
  );
});

function countrySource() {
  return [
    '# ISO country data',
    countryLine('FR', 'France', 'Paris', 547030, 67000000),
    countryLine('US', 'United States', 'Washington', 9629091, 340000000),
    '',
  ].join('\n');
}

function countryLine(countryCode, name, capital, area, population) {
  return [countryCode, '', '', '', name, capital, area, population, ''].join('\t');
}

function citySource() {
  return [
    cityLine(2988507, 'Paris', 48.85341, 2.3488, 'PPLC', 'FR', 2138551, 'Europe/Paris'),
    cityLine(2996944, 'Lyon', 45.74846, 4.84671, 'PPLA', 'FR', 522969, 'Europe/Paris'),
    cityLine(4140963, 'Washington', 38.89511, -77.03637, 'PPLC', 'US', 689545, 'America/New_York'),
    cityLine(
      5128581,
      'New York City',
      40.71427,
      -74.00597,
      'PPL',
      'US',
      8804190,
      'America/New_York',
    ),
    cityLine(
      5368361,
      'Los Angeles',
      34.05223,
      -118.24368,
      'PPL',
      'US',
      3898747,
      'America/Los_Angeles',
    ),
  ].join('\n');
}

function cityLine(id, name, latitude, longitude, featureCode, countryCode, population, timeZone) {
  return [
    id,
    name,
    name,
    '',
    latitude,
    longitude,
    'P',
    featureCode,
    countryCode,
    '',
    '',
    '',
    '',
    '',
    population,
    '',
    '',
    timeZone,
    '2026-08-15',
  ].join('\t');
}
