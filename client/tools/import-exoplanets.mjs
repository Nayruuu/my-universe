import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXOPLANET_CATALOG_MAGIC = 'UMEX';
export const EXOPLANET_CATALOG_VERSION = 1;
export const EXOPLANET_CATALOG_HEADER_BYTES = 32;
export const EXOPLANET_CATALOG_HOST_RECORD_BYTES = 64;
export const EXOPLANET_CATALOG_PLANET_RECORD_BYTES = 72;

const STRING_SEPARATOR = '\u001f';
const DEFAULT_OUTPUT = resolve('public/data/exoplanets/nasa-pscomppars.bin');
const DEFAULT_METADATA = resolve('public/data/exoplanets/nasa-pscomppars.meta.json');
const TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const ARCHIVE_URL = 'https://exoplanetarchive.ipac.caltech.edu/';
const TAP_QUERY =
  'select pl_name,hostname,pl_letter,hd_name,hip_name,tic_id,gaia_dr3_id,sy_snum,sy_pnum,cb_flag,discoverymethod,disc_year,disc_facility,pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_bmassprov,pl_eqt,pl_orbeccen,pl_orbincl,pl_insol,st_teff,st_rad,st_mass,st_spectype,sy_vmag,ra,dec,sy_dist,pl_controv_flag from pscomppars order by hostname,pl_name';

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function buildExoplanetCatalog(sourceRows) {
  if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
    throw invalidSource('empty NASA response');
  }
  const planetsByName = new Map();

  for (const [index, sourceRow] of sourceRows.entries()) {
    const row = parseNasaRow(sourceRow, index);

    if (planetsByName.has(row.name)) {
      throw invalidSource(`duplicate planet ${row.name}`);
    }
    planetsByName.set(row.name, row);
  }

  const sortedRows = [...planetsByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'en'),
  );
  const groupedRows = new Map();

  for (const row of sortedRows) {
    const rows = groupedRows.get(row.hostname) ?? [];

    if (rows.length > 0) {
      assertConsistentHost(rows[0], row);
    }
    rows.push(row);
    groupedRows.set(row.hostname, rows);
  }

  const hostNames = [...groupedRows.keys()].sort((left, right) => left.localeCompare(right, 'en'));
  const hosts = [];
  const planets = [];

  for (const [hostIndex, hostname] of hostNames.entries()) {
    const rows = groupedRows.get(hostname);
    const first = rows[0];
    const aliases = uniqueStrings(
      rows.flatMap((row) => [row.hdName, row.hipName, row.ticId, row.gaiaDr3Id]),
    );
    const firstPlanetIndex = planets.length;

    for (const row of rows) {
      planets.push({
        name: row.name,
        letter: row.letter,
        discoveryMethod: row.discoveryMethod,
        discoveryFacility: row.discoveryFacility,
        massProvenance: row.massProvenance,
        hostIndex,
        orbitalPeriodDays: row.orbitalPeriodDays,
        semiMajorAxisAu: row.semiMajorAxisAu,
        radiusEarth: row.radiusEarth,
        massEarth: row.massEarth,
        equilibriumTemperatureKelvin: row.equilibriumTemperatureKelvin,
        eccentricity: row.eccentricity,
        inclinationDegrees: row.inclinationDegrees,
        insolationEarth: row.insolationEarth,
        discoveryYear: row.discoveryYear,
        controversial: row.controversial,
      });
    }

    hosts.push({
      name: hostname,
      aliases,
      spectralType: first.spectralType,
      firstPlanetIndex,
      planetCount: rows.length,
      starCount: Math.max(1, ...rows.map((row) => row.starCount)),
      circumbinary: rows.some((row) => row.circumbinary),
      rightAscensionDegrees: first.rightAscensionDegrees,
      declinationDegrees: first.declinationDegrees,
      distanceParsec: first.distanceParsec,
      temperatureKelvin: first.temperatureKelvin,
      radiusSolar: first.radiusSolar,
      massSolar: first.massSolar,
      apparentMagnitude: first.apparentMagnitude,
    });
  }

  return { hosts, planets };
}

export function encodeExoplanetCatalog(catalog) {
  if (!catalog.hosts.length || !catalog.planets.length) {
    throw new Error('Cannot encode an empty exoplanet catalog.');
  }
  const strings = createStringTable(catalog);
  const planetRecordsOffset =
    EXOPLANET_CATALOG_HEADER_BYTES + catalog.hosts.length * EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const stringTableOffset =
    planetRecordsOffset + catalog.planets.length * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringTableOffset + strings.bytes.length);
  const view = new DataView(buffer);

  writeMagic(view);
  view.setUint16(4, EXOPLANET_CATALOG_VERSION, true);
  view.setUint16(6, EXOPLANET_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, EXOPLANET_CATALOG_HOST_RECORD_BYTES, true);
  view.setUint16(10, EXOPLANET_CATALOG_PLANET_RECORD_BYTES, true);
  view.setUint32(12, catalog.hosts.length, true);
  view.setUint32(16, catalog.planets.length, true);
  view.setUint32(20, planetRecordsOffset, true);
  view.setUint32(24, stringTableOffset, true);
  view.setUint32(28, strings.bytes.length, true);

  catalog.hosts.forEach((host, index) => {
    const offset = EXOPLANET_CATALOG_HEADER_BYTES + index * EXOPLANET_CATALOG_HOST_RECORD_BYTES;
    const stringOffsets = strings.hosts[index];

    view.setUint32(offset, stringOffsets.name, true);
    view.setUint32(offset + 4, stringOffsets.aliases, true);
    view.setUint32(offset + 8, stringOffsets.spectralType, true);
    view.setUint32(offset + 12, host.firstPlanetIndex, true);
    view.setUint16(offset + 16, host.planetCount, true);
    view.setUint8(offset + 18, Math.min(255, host.starCount));
    view.setUint8(offset + 19, host.circumbinary ? 1 : 0);
    view.setFloat64(offset + 20, host.rightAscensionDegrees, true);
    view.setFloat64(offset + 28, host.declinationDegrees, true);
    view.setFloat64(offset + 36, optionalBinaryNumber(host.distanceParsec), true);
    view.setFloat32(offset + 44, optionalBinaryNumber(host.temperatureKelvin), true);
    view.setFloat32(offset + 48, optionalBinaryNumber(host.radiusSolar), true);
    view.setFloat32(offset + 52, optionalBinaryNumber(host.massSolar), true);
    view.setFloat32(offset + 56, optionalBinaryNumber(host.apparentMagnitude), true);
    view.setUint32(offset + 60, 0, true);
  });

  catalog.planets.forEach((planet, index) => {
    const offset = planetRecordsOffset + index * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
    const stringOffsets = strings.planets[index];

    view.setUint32(offset, stringOffsets.name, true);
    view.setUint32(offset + 4, stringOffsets.letter, true);
    view.setUint32(offset + 8, stringOffsets.discoveryMethod, true);
    view.setUint32(offset + 12, stringOffsets.discoveryFacility, true);
    view.setUint32(offset + 16, stringOffsets.massProvenance, true);
    view.setUint32(offset + 20, planet.hostIndex, true);
    view.setFloat64(offset + 24, optionalBinaryNumber(planet.orbitalPeriodDays), true);
    view.setFloat64(offset + 32, optionalBinaryNumber(planet.semiMajorAxisAu), true);
    view.setFloat32(offset + 40, optionalBinaryNumber(planet.radiusEarth), true);
    view.setFloat32(offset + 44, optionalBinaryNumber(planet.massEarth), true);
    view.setFloat32(offset + 48, optionalBinaryNumber(planet.equilibriumTemperatureKelvin), true);
    view.setFloat32(offset + 52, optionalBinaryNumber(planet.eccentricity), true);
    view.setFloat32(offset + 56, optionalBinaryNumber(planet.inclinationDegrees), true);
    view.setFloat32(offset + 60, optionalBinaryNumber(planet.insolationEarth), true);
    view.setUint16(offset + 64, planet.discoveryYear ?? 0, true);
    view.setUint16(offset + 66, planet.controversial ? 1 : 0, true);
    view.setUint32(offset + 68, 0, true);
  });
  new Uint8Array(buffer, stringTableOffset).set(strings.bytes);

  return new Uint8Array(buffer);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourceBytes = options.input
    ? await readFile(options.input)
    : new Uint8Array(await fetchNasaSnapshot());
  const rows = JSON.parse(new TextDecoder().decode(sourceBytes));
  const catalog = buildExoplanetCatalog(rows);
  const binary = encodeExoplanetCatalog(catalog);
  const positionedHosts = catalog.hosts.filter((host) => host.distanceParsec !== null).length;
  const positionedPlanets = catalog.planets.filter(
    (planet) => catalog.hosts[planet.hostIndex].distanceParsec !== null,
  ).length;
  const metadata = {
    version: '1.0.0',
    format: 'exoplanet-catalog-v1',
    source: {
      name: 'NASA Exoplanet Archive',
      url: ARCHIVE_URL,
      tapUrl: TAP_URL,
      table: 'PSCompPars',
      query: TAP_QUERY,
      snapshotDate: options.snapshotDate,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    },
    counts: {
      hosts: catalog.hosts.length,
      planets: catalog.planets.length,
      positionedHosts,
      positionedPlanets,
    },
    missingDistanceFallbackParsec: 1_000,
  };

  await Promise.all([
    writeAsset(options.output, binary),
    writeAsset(options.metadata, `${JSON.stringify(metadata, null, 2)}\n`),
  ]);
  console.log(
    `NASA exoplanet catalog generated: ${catalog.planets.length.toLocaleString('en-US')} planets around ${catalog.hosts.length.toLocaleString('en-US')} hosts, ${positionedPlanets.toLocaleString('en-US')} positionable (${relative(process.cwd(), options.output)}).`,
  );
}

async function fetchNasaSnapshot() {
  const url = new URL(TAP_URL);

  url.searchParams.set('query', TAP_QUERY);
  url.searchParams.set('format', 'json');
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`NASA Exoplanet Archive request failed (${response.status}).`);
  }

  return response.arrayBuffer();
}

function parseArguments(argumentsList) {
  const options = {
    input: null,
    output: DEFAULT_OUTPUT,
    metadata: DEFAULT_METADATA,
    snapshotDate: new Date().toISOString().slice(0, 10),
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (!value || !['--input', '--output', '--metadata', '--snapshot-date'].includes(argument)) {
      throw new Error(`Unknown or incomplete argument: ${argument}.`);
    }
    index += 1;
    if (argument === '--input') {
      options.input = resolve(value);
    } else if (argument === '--output') {
      options.output = resolve(value);
    } else if (argument === '--metadata') {
      options.metadata = resolve(value);
    } else {
      options.snapshotDate = value;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(options.snapshotDate)) {
    throw new Error(`Invalid snapshot date: ${options.snapshotDate}.`);
  }

  return options;
}

function parseNasaRow(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidSource(`row ${index + 1} is not an object`);
  }
  const name = requiredString(value.pl_name, 'planet name');
  const hostname = requiredString(value.hostname, `host name for ${name}`);
  const rightAscensionDegrees = requiredNumber(value.ra, `right ascension for ${name}`);
  const declinationDegrees = requiredNumber(value.dec, `declination for ${name}`);

  if (rightAscensionDegrees < 0 || rightAscensionDegrees >= 360) {
    throw invalidSource(`invalid right ascension for ${name}`);
  }
  if (declinationDegrees < -90 || declinationDegrees > 90) {
    throw invalidSource(`invalid declination for ${name}`);
  }

  return {
    name,
    hostname,
    letter: optionalString(value.pl_letter),
    hdName: optionalString(value.hd_name),
    hipName: optionalString(value.hip_name),
    ticId: optionalString(value.tic_id),
    gaiaDr3Id: optionalString(value.gaia_dr3_id),
    starCount: optionalInteger(value.sy_snum, 1, 255, `star count for ${name}`) ?? 1,
    circumbinary: value.cb_flag === 1,
    discoveryMethod: optionalString(value.discoverymethod),
    discoveryYear: optionalInteger(value.disc_year, 1, 65_535, `discovery year for ${name}`),
    discoveryFacility: optionalString(value.disc_facility),
    orbitalPeriodDays: optionalPositiveNumber(value.pl_orbper, `orbital period for ${name}`),
    semiMajorAxisAu: optionalPositiveNumber(value.pl_orbsmax, `semi-major axis for ${name}`),
    radiusEarth: optionalPositiveNumber(value.pl_rade, `radius for ${name}`),
    massEarth: optionalPositiveNumber(value.pl_bmasse, `mass for ${name}`),
    massProvenance: optionalString(value.pl_bmassprov),
    equilibriumTemperatureKelvin: optionalPositiveNumber(
      value.pl_eqt,
      `equilibrium temperature for ${name}`,
    ),
    eccentricity: optionalRangeNumber(value.pl_orbeccen, 0, 1, `eccentricity for ${name}`),
    inclinationDegrees: optionalRangeNumber(value.pl_orbincl, -360, 360, `inclination for ${name}`),
    insolationEarth: optionalNonNegativeNumber(value.pl_insol, `insolation for ${name}`),
    temperatureKelvin: optionalPositiveNumber(value.st_teff, `host temperature for ${name}`),
    radiusSolar: optionalPositiveNumber(value.st_rad, `host radius for ${name}`),
    massSolar: optionalPositiveNumber(value.st_mass, `host mass for ${name}`),
    spectralType: optionalString(value.st_spectype),
    apparentMagnitude: optionalNumber(value.sy_vmag, `apparent magnitude for ${name}`),
    rightAscensionDegrees,
    declinationDegrees,
    distanceParsec: optionalPositiveNumber(value.sy_dist, `distance for ${name}`),
    controversial: value.pl_controv_flag === 1,
  };
}

function assertConsistentHost(reference, candidate) {
  if (
    Math.abs(reference.rightAscensionDegrees - candidate.rightAscensionDegrees) > 0.000_001 ||
    Math.abs(reference.declinationDegrees - candidate.declinationDegrees) > 0.000_001
  ) {
    throw invalidSource(`inconsistent sky position for host ${reference.hostname}`);
  }
  if (
    reference.distanceParsec !== null &&
    candidate.distanceParsec !== null &&
    Math.abs(reference.distanceParsec - candidate.distanceParsec) > 0.001
  ) {
    throw invalidSource(`inconsistent distance for host ${reference.hostname}`);
  }
}

function createStringTable(catalog) {
  const encoder = new TextEncoder();
  const bytes = [0];
  const offsets = new Map([['', 0]]);
  const add = (value) => {
    const existing = offsets.get(value);

    if (existing !== undefined) {
      return existing;
    }
    const offset = bytes.length;

    bytes.push(...encoder.encode(value), 0);
    offsets.set(value, offset);

    return offset;
  };

  const hosts = catalog.hosts.map((host) => ({
    name: add(host.name),
    aliases: add(host.aliases.join(STRING_SEPARATOR)),
    spectralType: add(host.spectralType),
  }));
  const planets = catalog.planets.map((planet) => ({
    name: add(planet.name),
    letter: add(planet.letter),
    discoveryMethod: add(planet.discoveryMethod),
    discoveryFacility: add(planet.discoveryFacility),
    massProvenance: add(planet.massProvenance),
  }));

  return { bytes: new Uint8Array(bytes), hosts, planets };
}

function writeMagic(view) {
  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, EXOPLANET_CATALOG_MAGIC.charCodeAt(index));
  }
}

async function writeAsset(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function optionalBinaryNumber(value) {
  return value === null ? Number.NaN : value;
}

function requiredString(value, field) {
  const result = optionalString(value);

  if (!result) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requiredNumber(value, field) {
  const result = optionalNumber(value, field);

  if (result === null) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function optionalNumber(value, field) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidSource(`invalid ${field}`);
  }

  return value;
}

function optionalPositiveNumber(value, field) {
  const result = optionalNumber(value, field);

  if (result !== null && result <= 0) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function optionalNonNegativeNumber(value, field) {
  const result = optionalNumber(value, field);

  if (result !== null && result < 0) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function optionalRangeNumber(value, minimum, maximum, field) {
  const result = optionalNumber(value, field);

  if (result !== null && (result < minimum || result > maximum)) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function optionalInteger(value, minimum, maximum, field) {
  const result = optionalNumber(value, field);

  if (result !== null && (!Number.isInteger(result) || result < minimum || result > maximum)) {
    throw invalidSource(`invalid ${field}`);
  }

  return result;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function invalidSource(reason) {
  return new Error(`Invalid NASA PSCompPars source: ${reason}.`);
}
