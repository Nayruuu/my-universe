import { auditCosmicCatalogs } from './scientific-audit/cosmic-catalogs.mjs';
import { auditCuratedCatalogs } from './scientific-audit/curated-catalogs.mjs';
import { auditExoplanetCatalog } from './scientific-audit/exoplanet-catalog.mjs';
import { auditNearbyUniverse } from './scientific-audit/nearby-universe.mjs';
import { auditStellarCatalog } from './scientific-audit/stellar-catalog.mjs';

const DEFAULT_DATA_ROOT = new URL('../public/data/', import.meta.url);

export async function auditScientificDistances(dataRoot = DEFAULT_DATA_ROOT) {
  const anomalies = [];
  const { objects, report: curated } = await auditCuratedCatalogs(dataRoot, anomalies);
  const nearbyUniverse = await auditNearbyUniverse(dataRoot, anomalies);
  const hyg = await auditStellarCatalog(dataRoot, objects, anomalies);
  const exoplanets = await auditExoplanetCatalog(dataRoot, anomalies);
  const { cosmicGroups, cosmicStructures, tempelSpines } = await auditCosmicCatalogs(
    dataRoot,
    anomalies,
  );
  const totalRecordsInspected =
    curated.staticPositions +
    curated.orbitalDefinitions +
    nearbyUniverse.objects +
    hyg.records +
    exoplanets.hosts +
    exoplanets.planets +
    cosmicGroups.records +
    cosmicStructures.records +
    tempelSpines.points;

  return {
    totalRecordsInspected,
    curated,
    nearbyUniverse,
    hyg,
    exoplanets,
    cosmicGroups,
    cosmicStructures,
    tempelSpines,
    anomalies,
  };
}

export function assertScientificDistanceAudit(report) {
  if (report.anomalies.length === 0) {
    return;
  }
  const details = report.anomalies
    .map(({ family, id, reason }) => `${family} · ${id} · ${reason}`)
    .join('\n- ');

  throw new Error(`Scientific distance audit failed:\n- ${details}`);
}

export function formatScientificDistanceAudit(report) {
  const number = new Intl.NumberFormat('en-US');
  const fallback = number.format(report.exoplanets.fallbackDistanceParsec);

  return [
    `Scientific distance audit: ${number.format(report.totalRecordsInspected)} scientific records inspected.`,
    `- ${number.format(report.hyg.records)} HYG stars`,
    `- ${number.format(report.exoplanets.hosts)} exoplanet hosts and ${number.format(report.exoplanets.planets)} planets`,
    `- ${number.format(report.nearbyUniverse.objects)} nearby galaxies`,
    `- ${number.format(report.cosmicGroups.records)} Cosmicflows groups`,
    `- ${number.format(report.cosmicStructures.records)} documented cosmic structures`,
    `- ${number.format(report.tempelSpines.points)} published Tempel spine points`,
    `- ${report.exoplanets.missingDistanceHosts} exoplanet hosts use the labelled ${fallback} pc fallback`,
    `- ${report.exoplanets.planetsWithIllustrativeAxis} illustrative semi-major axes`,
    `- ${report.exoplanets.planetsWithIllustrativePeriod} illustrative orbital periods`,
    `- ${report.anomalies.length} distance-contract anomalies`,
  ].join('\n');
}
