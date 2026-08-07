import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_VERSION,
  buildExoplanetCatalog,
  encodeExoplanetCatalog,
} from './import-exoplanets.mjs';

test('groups NASA composite rows into deterministic hosts and planets', () => {
  const rows = [
    nasaRow('Test Star c', 'Test Star', {
      pl_letter: 'c',
      pl_orbper: 20,
      pl_orbsmax: 0.15,
      pl_rade: 2.4,
      pl_bmasse: 6.2,
    }),
    nasaRow('Nearby Star b', 'Nearby Star', {
      ra: 10,
      dec: -20,
      sy_dist: null,
      hd_name: 'HD 123',
      hip_name: 'HIP 456',
      sy_pnum: 1,
    }),
    nasaRow('Test Star b', 'Test Star', {
      pl_letter: 'b',
      pl_orbper: 5,
      pl_orbsmax: 0.05,
      pl_rade: 1.1,
      pl_bmasse: 1.4,
    }),
  ];
  const first = buildExoplanetCatalog(rows);
  const second = buildExoplanetCatalog([...rows].reverse());

  assert.deepEqual(first, second);
  assert.equal(first.hosts.length, 2);
  assert.equal(first.planets.length, 3);
  assert.deepEqual(
    first.hosts.map(({ name, firstPlanetIndex, planetCount }) => ({
      name,
      firstPlanetIndex,
      planetCount,
    })),
    [
      { name: 'Nearby Star', firstPlanetIndex: 0, planetCount: 1 },
      { name: 'Test Star', firstPlanetIndex: 1, planetCount: 2 },
    ],
  );
  assert.deepEqual(first.hosts[0].aliases, ['HD 123', 'HIP 456', 'TIC 123', 'Gaia DR3 456']);
  assert.equal(first.hosts[0].distanceParsec, null);
  assert.deepEqual(
    first.planets.map(({ name, hostIndex }) => ({ name, hostIndex })),
    [
      { name: 'Nearby Star b', hostIndex: 0 },
      { name: 'Test Star b', hostIndex: 1 },
      { name: 'Test Star c', hostIndex: 1 },
    ],
  );
});

test('preserves missing composite values and scientific status flags', () => {
  const catalog = buildExoplanetCatalog([
    nasaRow('Sparse Host b', 'Sparse Host', {
      pl_orbper: null,
      pl_orbsmax: null,
      pl_rade: null,
      pl_bmasse: null,
      pl_bmassprov: null,
      pl_eqt: null,
      pl_orbeccen: null,
      pl_orbincl: null,
      pl_insol: null,
      st_teff: null,
      st_rad: null,
      st_mass: null,
      st_spectype: null,
      sy_vmag: null,
      cb_flag: 1,
      pl_controv_flag: 1,
    }),
  ]);

  assert.equal(catalog.hosts[0].circumbinary, true);
  assert.equal(catalog.hosts[0].temperatureKelvin, null);
  assert.equal(catalog.planets[0].controversial, true);
  assert.equal(catalog.planets[0].orbitalPeriodDays, null);
  assert.equal(catalog.planets[0].massProvenance, '');
});

test('rejects duplicate planets, inconsistent hosts, and malformed NASA rows', () => {
  const duplicate = nasaRow('Duplicate b', 'Duplicate');
  const shiftedHost = nasaRow('Duplicate c', 'Duplicate', { ra: 42 });

  assert.throws(
    () => buildExoplanetCatalog([duplicate, duplicate]),
    /duplicate planet Duplicate b/u,
  );
  assert.throws(
    () => buildExoplanetCatalog([duplicate, shiftedHost]),
    /inconsistent sky position for host Duplicate/u,
  );
  assert.throws(
    () => buildExoplanetCatalog([{ ...duplicate, pl_name: '' }]),
    /invalid planet name/u,
  );
  assert.throws(() => buildExoplanetCatalog([{ ...duplicate, dec: 120 }]), /invalid declination/u);
  assert.throws(() => buildExoplanetCatalog([{ ...duplicate, sy_dist: -1 }]), /invalid distance/u);
});

test('encodes a deterministic self-describing compact catalogue', () => {
  const catalog = buildExoplanetCatalog([
    nasaRow('Binary Star b', 'Binary Star'),
    nasaRow('Binary Star c', 'Binary Star', { pl_letter: 'c', pl_orbper: 18 }),
  ]);
  const first = encodeExoplanetCatalog(catalog);
  const second = encodeExoplanetCatalog(catalog);
  const view = new DataView(first.buffer, first.byteOffset, first.byteLength);

  assert.deepEqual(first, second);
  assert.equal(new TextDecoder().decode(first.subarray(0, 4)), EXOPLANET_CATALOG_MAGIC);
  assert.equal(view.getUint16(4, true), EXOPLANET_CATALOG_VERSION);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 2);
  assert.ok(first.byteLength < JSON.stringify(catalog).length);
});

test('ships the complete NASA snapshot with reproducible provenance', async () => {
  const metadata = JSON.parse(
    await readFile(resolve('public/data/exoplanets/nasa-pscomppars.meta.json'), 'utf8'),
  );
  const binary = await readFile(resolve('public/data/exoplanets/nasa-pscomppars.bin'));

  assert.equal(metadata.format, 'exoplanet-catalog-v1');
  assert.equal(metadata.source.table, 'PSCompPars');
  assert.equal(metadata.source.snapshotDate, '2026-08-05');
  assert.equal(metadata.counts.hosts, 4_747);
  assert.equal(metadata.counts.planets, 6_333);
  assert.equal(metadata.counts.positionedPlanets, 6_306);
  assert.match(metadata.source.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(binary.subarray(0, 4).toString('utf8'), EXOPLANET_CATALOG_MAGIC);
});

function nasaRow(planetName, hostname, overrides = {}) {
  return {
    pl_name: planetName,
    hostname,
    pl_letter: 'b',
    hd_name: null,
    hip_name: null,
    tic_id: 'TIC 123',
    gaia_dr3_id: 'Gaia DR3 456',
    sy_snum: 1,
    sy_pnum: 2,
    cb_flag: 0,
    discoverymethod: 'Transit',
    disc_year: 2024,
    disc_facility: 'Test Observatory',
    pl_orbper: 10,
    pl_orbsmax: 0.1,
    pl_rade: 1.5,
    pl_bmasse: 3.2,
    pl_bmassprov: 'Mass',
    pl_eqt: 280,
    pl_orbeccen: 0.03,
    pl_orbincl: 89.5,
    pl_insol: 1.1,
    st_teff: 5_500,
    st_rad: 0.9,
    st_mass: 0.95,
    st_spectype: 'G5 V',
    sy_vmag: 10.2,
    ra: 120,
    dec: 30,
    sy_dist: 50,
    pl_controv_flag: 0,
    ...overrides,
  };
}
