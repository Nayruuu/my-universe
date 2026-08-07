import { addAnomaly, dataView, isPositiveFinite, readBinary, readJson } from './shared.mjs';

const HEADER_BYTES = 32;
const HOST_RECORD_BYTES = 64;
const PLANET_RECORD_BYTES = 72;

export async function auditExoplanetCatalog(dataRoot, anomalies) {
  const metadata = await readJson(dataRoot, 'exoplanets/nasa-pscomppars.meta.json');
  const bytes = await readBinary(dataRoot, 'exoplanets/nasa-pscomppars.bin');
  const view = dataView(bytes);
  const hostCount = view.getUint32(12, true);
  const planetCount = view.getUint32(16, true);
  const planetRecordsOffset = view.getUint32(20, true);
  const hosts = auditHosts(view, hostCount, anomalies);
  const planets = auditPlanets(view, planetRecordsOffset, planetCount, hosts.masses, anomalies);

  if (
    hostCount !== metadata.counts.hosts ||
    planetCount !== metadata.counts.planets ||
    hosts.positioned !== metadata.counts.positionedHosts ||
    hosts.missingDistance !== hostCount - hosts.positioned
  ) {
    addAnomaly(anomalies, 'exoplanets', 'catalog', 'binary and metadata cardinalities differ');
  }
  if (!isPositiveFinite(metadata.missingDistanceFallbackParsec)) {
    addAnomaly(anomalies, 'exoplanets', 'catalog', 'missing-distance fallback is invalid');
  }

  return {
    hosts: hostCount,
    planets: planetCount,
    positionedHosts: hosts.positioned,
    missingDistanceHosts: hosts.missingDistance,
    fallbackDistanceParsec: metadata.missingDistanceFallbackParsec,
    planetsWithPublishedAxis: planets.publishedAxis,
    planetsWithCalculatedAxis: planets.calculatedAxis,
    planetsWithIllustrativeAxis: planets.illustrativeAxis,
    planetsWithPublishedPeriod: planets.publishedPeriod,
    planetsWithCalculatedPeriod: planets.calculatedPeriod,
    planetsWithIllustrativePeriod: planets.illustrativePeriod,
  };
}

function auditHosts(view, count, anomalies) {
  const masses = new Float64Array(count);
  let positioned = 0;
  let missingDistance = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_BYTES + index * HOST_RECORD_BYTES;
    const rightAscension = view.getFloat64(offset + 20, true);
    const declination = view.getFloat64(offset + 28, true);
    const distanceParsec = view.getFloat64(offset + 36, true);

    masses[index] = view.getFloat32(offset + 52, true);
    if (
      !Number.isFinite(rightAscension) ||
      rightAscension < 0 ||
      rightAscension >= 360 ||
      !Number.isFinite(declination) ||
      declination < -90 ||
      declination > 90
    ) {
      addAnomaly(anomalies, 'exoplanets', `host-${index}`, 'invalid ICRS direction');
    }
    if (isPositiveFinite(distanceParsec)) {
      positioned += 1;
    } else if (Number.isNaN(distanceParsec)) {
      missingDistance += 1;
    } else {
      addAnomaly(anomalies, 'exoplanets', `host-${index}`, 'invalid published distance');
    }
  }

  return { masses, positioned, missingDistance };
}

function auditPlanets(view, recordsOffset, count, hostMasses, anomalies) {
  const totals = {
    publishedAxis: 0,
    calculatedAxis: 0,
    illustrativeAxis: 0,
    publishedPeriod: 0,
    calculatedPeriod: 0,
    illustrativePeriod: 0,
  };

  for (let index = 0; index < count; index += 1) {
    auditPlanet(
      view,
      recordsOffset + index * PLANET_RECORD_BYTES,
      index,
      hostMasses,
      totals,
      anomalies,
    );
  }

  return totals;
}

function auditPlanet(view, offset, index, hostMasses, totals, anomalies) {
  const hostIndex = view.getUint32(offset + 20, true);
  const period = view.getFloat64(offset + 24, true);
  const semiMajorAxis = view.getFloat64(offset + 32, true);

  if (hostIndex >= hostMasses.length) {
    addAnomaly(anomalies, 'exoplanets', `planet-${index}`, `invalid host index ${hostIndex}`);
    return;
  }
  const hostMass = hostMasses[hostIndex];
  const axisSource = classifyAxis(semiMajorAxis, period, hostMass, index, anomalies);
  const periodSource = classifyPeriod(
    period,
    semiMajorAxis,
    hostMass,
    axisSource,
    index,
    anomalies,
  );

  totals[`${axisSource}Axis`] += 1;
  totals[`${periodSource}Period`] += 1;
}

function classifyAxis(axis, period, hostMass, index, anomalies) {
  if (isPositiveFinite(axis)) {
    return 'published';
  }
  if (!Number.isNaN(axis)) {
    addAnomaly(anomalies, 'exoplanets', `planet-${index}`, 'invalid semi-major axis');
  }

  return isPositiveFinite(period) && isPositiveFinite(hostMass) ? 'calculated' : 'illustrative';
}

function classifyPeriod(period, axis, hostMass, axisSource, index, anomalies) {
  if (isPositiveFinite(period)) {
    return 'published';
  }
  if (!Number.isNaN(period)) {
    addAnomaly(anomalies, 'exoplanets', `planet-${index}`, 'invalid orbital period');
  }

  return isPositiveFinite(hostMass) && (isPositiveFinite(axis) || axisSource === 'calculated')
    ? 'calculated'
    : 'illustrative';
}
