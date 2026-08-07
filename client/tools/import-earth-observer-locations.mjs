import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const DEFAULT_CITIES_INPUT = resolve('data-sources/geonames/cities500.txt');
const DEFAULT_COUNTRIES_INPUT = resolve('data-sources/geonames/countryInfo.txt');
const DEFAULT_OUTPUT = resolve('src/engine/simulation/earth-observer-locations.data.ts');
const SNAPSHOT_DATE = '2026-08-15';
const EXCLUDED_COUNTRY_CODES = new Set(['AQ', 'BV', 'HM', 'UM', 'CS', 'AN']);
const LEGACY_FRENCH_LOCATION_IDS = new Map([
  ['Paris', 'paris'],
  ['Lyon', 'lyon'],
  ['Clermont-Ferrand', 'clermont-ferrand'],
  ['Grenoble', 'grenoble'],
  ['Biarritz', 'biarritz'],
  ['Bordeaux', 'bordeaux'],
  ['Toulouse', 'toulouse'],
  ['Marseille', 'marseille'],
  ['Nantes', 'nantes'],
  ['Strasbourg', 'strasbourg'],
]);
const LEGACY_FRENCH_LOCATION_COORDINATES = new Map([
  ['Paris', [48.8566, 2.3522]],
  ['Lyon', [45.764, 4.8357]],
  ['Clermont-Ferrand', [45.7772, 3.087]],
  ['Grenoble', [45.1885, 5.7245]],
  ['Biarritz', [43.4832, -1.5586]],
  ['Bordeaux', [44.8378, -0.5792]],
  ['Toulouse', [43.6047, 1.4442]],
  ['Marseille', [43.2965, 5.3698]],
  ['Nantes', [47.2184, -1.5536]],
  ['Strasbourg', [48.5734, 7.7521]],
]);

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function parseGeoNamesCountries(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line, index) => {
      const fields = line.split('\t');
      const countryCode = fields[0]?.trim() ?? '';
      const name = fields[4]?.trim() ?? '';
      const capitalName = fields[5]?.trim() ?? '';
      const areaSquareKilometers = Number(fields[6]);
      const population = Number(fields[7]);

      if (
        countryCode.length !== 2 ||
        name.length === 0 ||
        !Number.isFinite(areaSquareKilometers) ||
        !Number.isFinite(population)
      ) {
        throw new Error(`Invalid GeoNames countryInfo record at line ${index + 1}.`);
      }

      return { countryCode, name, capitalName, areaSquareKilometers, population };
    });
}

export function parseGeoNamesCities(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const fields = line.split('\t');
      const geonameId = Number(fields[0]);
      const name = fields[1]?.trim() ?? '';
      const asciiName = fields[2]?.trim() ?? '';
      const latitude = Number(fields[4]);
      const longitude = Number(fields[5]);
      const featureClass = fields[6]?.trim() ?? '';
      const featureCode = fields[7]?.trim() ?? '';
      const countryCode = fields[8]?.trim() ?? '';
      const population = Number(fields[14]);
      const timeZone = fields[17]?.trim() ?? '';

      if (
        !Number.isInteger(geonameId) ||
        geonameId <= 0 ||
        name.length === 0 ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        featureClass !== 'P' ||
        countryCode.length !== 2 ||
        !Number.isFinite(population) ||
        timeZone.length === 0
      ) {
        throw new Error(`Invalid GeoNames cities500 record at line ${index + 1}.`);
      }

      return {
        geonameId,
        name,
        asciiName,
        latitude,
        longitude,
        featureCode,
        countryCode,
        population,
        timeZone,
      };
    });
}

export function buildEarthObserverLocationRecords(countries, cities) {
  const citiesByCountry = Map.groupBy(cities, ({ countryCode }) => countryCode);
  const selectedCities = new Map();

  for (const country of countries) {
    if (EXCLUDED_COUNTRY_CODES.has(country.countryCode)) {
      continue;
    }
    const countryCities = [...(citiesByCountry.get(country.countryCode) ?? [])].sort(compareCities);
    const capital = selectCapital(country, countryCities);

    if (!capital) {
      throw new Error(`No populated place found for ${country.name} (${country.countryCode}).`);
    }
    const chosen = [capital];
    const desiredCount = desiredLocationCount(country);
    const minimumSeparation = minimumSeparationKilometers(country.areaSquareKilometers);

    for (const city of countryCities) {
      if (
        chosen.length >= desiredCount ||
        chosen.some(({ geonameId }) => geonameId === city.geonameId) ||
        chosen.some((other) => greatCircleDistanceKilometers(city, other) < minimumSeparation)
      ) {
        continue;
      }
      chosen.push(city);
    }
    for (const city of chosen) {
      selectedCities.set(city.geonameId, {
        ...city,
        capital: city.geonameId === capital.geonameId,
      });
    }
  }

  for (const city of cities) {
    if (city.countryCode === 'FR' && LEGACY_FRENCH_LOCATION_IDS.has(city.name)) {
      selectedCities.set(city.geonameId, {
        ...city,
        capital: city.featureCode === 'PPLC',
      });
    }
  }

  const selected = [...selectedCities.values()];
  const paris = selected.find(({ name, countryCode }) => name === 'Paris' && countryCode === 'FR');

  if (!paris) {
    throw new Error(
      'The generated observer catalogue must preserve Paris as its default location.',
    );
  }
  const remaining = selected
    .filter(({ geonameId }) => geonameId !== paris.geonameId)
    .sort(compareOutputCities);

  return [paris, ...remaining].map((city) => {
    const [latitude, longitude] = LEGACY_FRENCH_LOCATION_COORDINATES.get(city.name) ?? [
      city.latitude,
      city.longitude,
    ];

    return [
      locationId(city),
      city.name,
      city.countryCode,
      latitude,
      longitude,
      city.timeZone,
      city.population,
      city.capital ? 1 : 0,
    ];
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [countriesSource, citiesSource] = await Promise.all([
    readFile(options.countries, 'utf8'),
    options.cities === '-' ? readStandardInput() : readFile(options.cities, 'utf8'),
  ]);
  const records = buildEarthObserverLocationRecords(
    parseGeoNamesCountries(countriesSource),
    parseGeoNamesCities(citiesSource),
  );
  const prettierConfig = (await resolveConfig(options.output)) ?? {};
  const source = await format(createTypeScriptModule(records), {
    ...prettierConfig,
    parser: 'typescript',
  });

  await writeFile(options.output, source, 'utf8');
  console.log(`Generated ${records.length} Earth observer locations in ${options.output}.`);
}

function createTypeScriptModule(records) {
  return (
    `// Generated by tools/import-earth-observer-locations.mjs from GeoNames cities500 and countryInfo.\n` +
    `// Snapshot: ${SNAPSHOT_DATE} · License: CC BY 4.0 · https://www.geonames.org/\n\n` +
    `export type EarthObserverLocationRecord = readonly [\n` +
    `  id: string,\n  name: string,\n  countryCode: string,\n  latitude: number,\n` +
    `  longitude: number,\n  timeZone: string,\n  population: number,\n  capital: 0 | 1,\n];\n\n` +
    `export const EARTH_OBSERVER_LOCATION_RECORDS = ${JSON.stringify(records, null, 2)} as const satisfies readonly EarthObserverLocationRecord[];\n`
  );
}

function parseArguments(argumentsList) {
  const options = {
    cities: DEFAULT_CITIES_INPUT,
    countries: DEFAULT_COUNTRIES_INPUT,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (!value || !['--cities', '--countries', '--output'].includes(argument)) {
      throw new Error(`Unsupported or incomplete argument: ${argument}.`);
    }
    options[argument.slice(2)] = argument === '--cities' && value === '-' ? value : resolve(value);
    index += 1;
  }

  return options;
}

function selectCapital(country, cities) {
  return (
    cities.find(({ featureCode }) => featureCode === 'PPLC') ??
    cities.find(
      ({ name, asciiName }) => name === country.capitalName || asciiName === country.capitalName,
    ) ??
    cities[0]
  );
}

function desiredLocationCount(country) {
  if (country.population >= 150_000_000 || country.areaSquareKilometers >= 5_000_000) {
    return 8;
  }
  if (country.population >= 50_000_000 || country.areaSquareKilometers >= 2_000_000) {
    return 4;
  }
  if (country.population >= 10_000_000 || country.areaSquareKilometers >= 500_000) {
    return 2;
  }

  return 1;
}

function minimumSeparationKilometers(areaSquareKilometers) {
  if (areaSquareKilometers < 50_000) {
    return 30;
  }
  if (areaSquareKilometers < 500_000) {
    return 75;
  }

  return 140;
}

function greatCircleDistanceKilometers(first, second) {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * toRadians;
  const longitudeDelta = (second.longitude - first.longitude) * toRadians;
  const firstLatitude = first.latitude * toRadians;
  const secondLatitude = second.latitude * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6_371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function compareCities(left, right) {
  return right.population - left.population || left.name.localeCompare(right.name, 'en');
}

function compareOutputCities(left, right) {
  return (
    left.countryCode.localeCompare(right.countryCode, 'en') ||
    Number(right.capital) - Number(left.capital) ||
    compareCities(left, right)
  );
}

function locationId(city) {
  return LEGACY_FRENCH_LOCATION_IDS.get(city.name) ?? `geonames-${city.geonameId}`;
}

async function readStandardInput() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}
