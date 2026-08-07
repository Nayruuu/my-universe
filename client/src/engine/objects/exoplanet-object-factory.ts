import type { SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import { convertDistance } from '../coordinates/unit-conversion';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import {
  compactDefinedValues,
  finiteCatalogValue,
  isPositiveFiniteCatalogValue,
  nonZeroCatalogValue,
  stableCatalogHash,
} from './exoplanet-catalog-values';
import { createExoplanetSpatialModel, type ExoplanetSpatialModel } from './exoplanet-spatial-model';

const J2000_JULIAN_DAY = 2_451_545;
const EARTH_RADIUS_KILOMETERS = 6_371;
const EARTH_MASS_KILOGRAMS = 5.9722e24;
const SOLAR_RADIUS_KILOMETERS = 695_700;
const SOLAR_MASS_KILOGRAMS = 1.98847e30;

export const EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE =
  'Illustrative radial depth; NASA publishes the sky direction but no system distance';

export class ExoplanetObjectFactory {
  public readonly renderPositions: Float32Array;

  private readonly spatialModel: ExoplanetSpatialModel;

  constructor(
    private readonly catalog: ExoplanetCatalog,
    coordinateSystem: CoordinateSystem,
    private readonly hostObjectIds: readonly string[],
    private readonly planetObjectIds: readonly string[],
  ) {
    this.spatialModel = createExoplanetSpatialModel(catalog, coordinateSystem);
    this.renderPositions = this.spatialModel.renderPositions;
  }

  public createHostDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const distanceParsec = catalog.hostDistancesParsec[index]!;
    const mapDistance = Number.isFinite(distanceParsec)
      ? distanceParsec
      : catalog.metadata.missingDistanceFallbackParsec;
    const galactic = this.spatialModel.getGalacticPosition(index);
    const temperature = catalog.hostTemperaturesKelvin[index]!;
    const radiusSolar = catalog.hostRadiiSolar[index]!;
    const massSolar = catalog.hostMassesSolar[index]!;
    const spectralType = catalog.hostSpectralTypes[index];
    const missingDistance = !Number.isFinite(distanceParsec);

    return {
      id: this.hostObjectIds[index]!,
      name: catalog.hostNames[index]!,
      aliases: [...catalog.hostAliases[index]!],
      type: 'star',
      parentId: 'milky-way',
      referenceFrame: 'stellar',
      scientificConfidence: 'observed',
      description: `Étoile hôte de ${catalog.hostPlanetCounts[index]} exoplanète${catalog.hostPlanetCounts[index] === 1 ? '' : 's'} confirmée${catalog.hostPlanetCounts[index] === 1 ? '' : 's'} dans le catalogue composite de la NASA Exoplanet Archive.`,
      referenceEpoch: J2000_JULIAN_DAY,
      physical: compactDefinedValues({
        radiusKm: multiplyFinite(radiusSolar, SOLAR_RADIUS_KILOMETERS),
        massKg: multiplyFinite(massSolar, SOLAR_MASS_KILOGRAMS),
        temperatureK: finiteCatalogValue(temperature),
        spectralType: spectralType ?? undefined,
      }),
      visual: {
        color: stellarTemperatureColor(temperature),
        emissiveColor: stellarTemperatureColor(temperature),
        emissiveIntensity: 1.2,
        visualRadius: 1.05,
        scaleMode: 'adaptive',
      },
      positionProvider: {
        type: 'static',
        position: [galactic.x, galactic.y, galactic.z],
        unit: 'parsec',
      },
      metadata: compactDefinedValues({
        source: 'NASA Exoplanet Archive · PSCompPars',
        sourceUrl: nasaOverviewUrl(catalog.hostNames[index]!),
        sourceTable: catalog.metadata.source.table,
        catalogSnapshotDate: catalog.metadata.source.snapshotDate,
        exoplanetHost: true,
        rightAscensionDegrees: catalog.hostRightAscensionDegrees[index]!,
        declinationDegrees: catalog.hostDeclinationDegrees[index]!,
        distancePc: finiteCatalogValue(distanceParsec),
        distanceLy: Number.isFinite(distanceParsec)
          ? convertDistance(distanceParsec, 'parsec', 'light-year')
          : undefined,
        apparentMagnitude: finiteCatalogValue(catalog.hostApparentMagnitudes[index]!),
        planetCount: catalog.hostPlanetCounts[index]!,
        starCount: catalog.hostStarCounts[index]!,
        circumbinarySystem: catalog.hostCircumbinaryFlags[index] === 1,
        mapDistanceUnavailable: missingDistance || undefined,
        mapDistanceFallbackPc: missingDistance ? mapDistance : undefined,
        mapDistanceConfidence: missingDistance
          ? EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE
          : undefined,
        sourceReferenceFrame: 'ICRS J2000',
        renderReferenceFrame: 'Galactique héliocentrique, pôle Nord galactique sur +Y',
        visualAdaptation: 'Distance comprimée et taille stellaire exagérée',
      }),
    };
  }

  public createPlanetDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const hostIndex = catalog.planetHostIndices[index]!;
    const orbit = this.spatialModel.getResolvedOrbit(index);
    const radiusEarth = catalog.planetRadiiEarth[index]!;
    const massEarth = catalog.planetMassesEarth[index]!;
    const equilibriumTemperature = catalog.planetEquilibriumTemperaturesKelvin[index]!;
    const eccentricity = catalog.planetEccentricities[index]!;
    const inclination = catalog.planetInclinationsDegrees[index]!;
    const insolation = catalog.planetInsolationsEarth[index]!;
    const distanceParsec = catalog.hostDistancesParsec[hostIndex]!;
    const missingDistance = !Number.isFinite(distanceParsec);
    const hash = stableCatalogHash(catalog.planetNames[index]!);
    const colors = planetColors(radiusEarth, equilibriumTemperature);

    return {
      id: this.planetObjectIds[index]!,
      name: catalog.planetNames[index]!,
      aliases: [],
      type: 'exoplanet',
      parentId: this.hostObjectIds[hostIndex]!,
      referenceFrame: 'stellar',
      scientificConfidence: 'observed',
      description:
        'Exoplanète confirmée recensée dans la table composite PSCompPars de la NASA Exoplanet Archive. Sa surface et son apparence ne sont pas directement observées.',
      physical: compactDefinedValues({
        radiusKm: multiplyFinite(radiusEarth, EARTH_RADIUS_KILOMETERS),
        massKg: multiplyFinite(massEarth, EARTH_MASS_KILOGRAMS),
      }),
      visual: {
        color: colors.primary,
        secondaryColor: colors.secondary,
        visualRadius: visualPlanetRadius(radiusEarth),
        scaleMode: 'adaptive',
      },
      positionProvider: {
        type: 'illustrative-orbit',
        semiMajorAxis: orbit.semiMajorAxisAu,
        orbitalPeriodDays: orbit.orbitalPeriodDays,
        epochJulianDay: J2000_JULIAN_DAY,
        visualPhaseAtEpochDegrees: hash % 360,
        visualInclinationDegrees: ((hash >>> 9) % 13) - 6,
        unit: 'astronomical-unit',
        distanceScale: this.spatialModel.getOrbitDistanceScale(hostIndex),
      },
      metadata: compactDefinedValues({
        source: 'NASA Exoplanet Archive · PSCompPars',
        sourceUrl: nasaOverviewUrl(catalog.hostNames[hostIndex]!),
        sourceTable: catalog.metadata.source.table,
        catalogSnapshotDate: catalog.metadata.source.snapshotDate,
        confirmationStatus: 'Confirmed Planet',
        detectionMethod: catalog.planetDiscoveryMethods[index]!,
        discoveryFacility: catalog.planetDiscoveryFacilities[index]!,
        discoveryYear: nonZeroCatalogValue(catalog.planetDiscoveryYears[index]!),
        distancePc: finiteCatalogValue(distanceParsec),
        distanceLy: Number.isFinite(distanceParsec)
          ? convertDistance(distanceParsec, 'parsec', 'light-year')
          : undefined,
        semiMajorAxisAu: finiteCatalogValue(catalog.planetSemiMajorAxesAu[index]!),
        orbitalPeriodDays: finiteCatalogValue(catalog.planetOrbitalPeriodsDays[index]!),
        equilibriumTemperatureK: finiteCatalogValue(equilibriumTemperature),
        orbitalInclinationDegrees: finiteCatalogValue(inclination),
        eccentricity: finiteCatalogValue(eccentricity),
        insolationEarth: finiteCatalogValue(insolation),
        radiusEarth: finiteCatalogValue(radiusEarth),
        massEarth: finiteCatalogValue(massEarth),
        massProvenance: catalog.planetMassProvenances[index]!,
        controversial: catalog.planetControversialFlags[index] === 1,
        semiMajorAxisSource: orbit.semiMajorAxisSource,
        orbitalPeriodSource: orbit.orbitalPeriodSource,
        orbitRepresentationConfidence: 'illustrative',
        visualSource: 'Apparence procédurale illustrative ; aucune surface observée',
        mapDistanceUnavailable: missingDistance || undefined,
        mapDistanceFallbackPc: missingDistance
          ? catalog.metadata.missingDistanceFallbackParsec
          : undefined,
        mapDistanceConfidence: missingDistance
          ? EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE
          : undefined,
      }),
    };
  }
}

function visualPlanetRadius(radiusEarth: number): number {
  return isPositiveFiniteCatalogValue(radiusEarth)
    ? clamp(0.38 + Math.log1p(radiusEarth) * 0.2, 0.45, 0.95)
    : 0.55;
}

function planetColors(
  radiusEarth: number,
  temperatureKelvin: number,
): { readonly primary: string; readonly secondary: string } {
  if (isPositiveFiniteCatalogValue(temperatureKelvin) && temperatureKelvin > 700) {
    return { primary: '#c97955', secondary: '#6f342d' };
  }
  if (isPositiveFiniteCatalogValue(radiusEarth) && radiusEarth >= 6) {
    return { primary: '#d5b178', secondary: '#76604a' };
  }
  if (isPositiveFiniteCatalogValue(radiusEarth) && radiusEarth >= 2.5) {
    return { primary: '#70a9bd', secondary: '#315b78' };
  }

  return { primary: '#6fb6a2', secondary: '#315d62' };
}

function stellarTemperatureColor(temperatureKelvin: number): string {
  if (!isPositiveFiniteCatalogValue(temperatureKelvin)) {
    return '#ffe2b8';
  }
  if (temperatureKelvin >= 10_000) {
    return '#9bbcff';
  }
  if (temperatureKelvin >= 7_500) {
    return '#cad8ff';
  }
  if (temperatureKelvin >= 6_000) {
    return '#fff4e8';
  }
  if (temperatureKelvin >= 5_000) {
    return '#ffe6bd';
  }
  if (temperatureKelvin >= 3_500) {
    return '#ffba82';
  }

  return '#ff7955';
}

function nasaOverviewUrl(hostName: string): string {
  return `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(hostName)}`;
}

function multiplyFinite(value: number, multiplier: number): number | undefined {
  return Number.isFinite(value) ? value * multiplier : undefined;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
