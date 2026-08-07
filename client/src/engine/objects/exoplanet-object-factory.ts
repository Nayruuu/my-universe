import type { SpaceObject } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import { convertDistance } from '../coordinates/unit-conversion';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import {
  compactDefinedValues,
  finiteCatalogValue,
  isPositiveFiniteCatalogValue,
  nonZeroCatalogValue,
  stableCatalogHash,
} from './exoplanet-catalog-values';

const J2000_JULIAN_DAY = 2_451_545;
const EARTH_RADIUS_KILOMETERS = 6_371;
const EARTH_MASS_KILOGRAMS = 5.9722e24;
const SOLAR_RADIUS_KILOMETERS = 695_700;
const SOLAR_MASS_KILOGRAMS = 1.98847e30;
const SYSTEM_MAXIMUM_ORBIT_RADIUS = 18;
const MINIMUM_ORBIT_DISTANCE_SCALE = 200;
const MAXIMUM_ORBIT_DISTANCE_SCALE = 50_000;

export const EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE =
  'Illustrative radial depth; NASA publishes the sky direction but no system distance';

interface ResolvedOrbit {
  readonly semiMajorAxisAu: number;
  readonly orbitalPeriodDays: number;
  readonly semiMajorAxisSource: string;
  readonly orbitalPeriodSource: string;
}

interface GalacticPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class ExoplanetObjectFactory {
  public readonly renderPositions: Float32Array;

  private readonly galacticPositions: Float64Array;
  private readonly resolvedOrbits: readonly ResolvedOrbit[];
  private readonly orbitDistanceScales: Float64Array;

  constructor(
    private readonly catalog: ExoplanetCatalog,
    private readonly coordinateSystem: CoordinateSystem,
    private readonly hostObjectIds: readonly string[],
    private readonly planetObjectIds: readonly string[],
  ) {
    this.galacticPositions = this.createGalacticPositions();
    this.renderPositions = this.createRenderPositions();
    this.resolvedOrbits = this.createResolvedOrbits();
    this.orbitDistanceScales = this.createOrbitDistanceScales();
  }

  public createHostDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const distanceParsec = catalog.hostDistancesParsec[index]!;
    const mapDistance = Number.isFinite(distanceParsec)
      ? distanceParsec
      : catalog.metadata.missingDistanceFallbackParsec;
    const galactic = this.getGalacticPosition(index);
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
    const orbit = this.resolvedOrbits[index]!;
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
        distanceScale: this.orbitDistanceScales[hostIndex]!,
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

  private createGalacticPositions(): Float64Array {
    const positions = new Float64Array(this.catalog.hostCount * 3);

    for (let index = 0; index < this.catalog.hostCount; index += 1) {
      const rightAscension = degreesToRadians(this.catalog.hostRightAscensionDegrees[index]!);
      const declination = degreesToRadians(this.catalog.hostDeclinationDegrees[index]!);
      const publishedDistance = this.catalog.hostDistancesParsec[index]!;
      const distance = Number.isFinite(publishedDistance)
        ? publishedDistance
        : this.catalog.metadata.missingDistanceFallbackParsec;
      const galactic = equatorialJ2000ToGalacticScene({
        x: distance * Math.cos(declination) * Math.cos(rightAscension),
        y: distance * Math.cos(declination) * Math.sin(rightAscension),
        z: distance * Math.sin(declination),
      });
      const offset = index * 3;

      positions[offset] = galactic.x;
      positions[offset + 1] = galactic.y;
      positions[offset + 2] = galactic.z;
    }

    return positions;
  }

  private createRenderPositions(): Float32Array {
    const positions = new Float32Array(this.catalog.hostCount * 3);

    for (let index = 0; index < this.catalog.hostCount; index += 1) {
      const galactic = this.getGalacticPosition(index);
      const position = this.coordinateSystem.toRenderPosition(
        [galactic.x, galactic.y, galactic.z],
        'parsec',
        'stellar',
      );
      const offset = index * 3;

      positions[offset] = position.x;
      positions[offset + 1] = position.y;
      positions[offset + 2] = position.z;
    }

    return positions;
  }

  private createResolvedOrbits(): readonly ResolvedOrbit[] {
    return Array.from({ length: this.catalog.planetCount }, (_, planetIndex) => {
      const hostIndex = this.catalog.planetHostIndices[planetIndex]!;
      const firstPlanetIndex = this.catalog.hostFirstPlanetIndices[hostIndex]!;
      const systemIndex = planetIndex - firstPlanetIndex;
      const catalogAxis = this.catalog.planetSemiMajorAxesAu[planetIndex]!;
      const catalogPeriod = this.catalog.planetOrbitalPeriodsDays[planetIndex]!;
      const hostMass = this.catalog.hostMassesSolar[hostIndex]!;
      let semiMajorAxisAu = catalogAxis;
      let orbitalPeriodDays = catalogPeriod;
      let semiMajorAxisSource = 'NASA Exoplanet Archive';
      let orbitalPeriodSource = 'NASA Exoplanet Archive';

      if (!isPositiveFiniteCatalogValue(semiMajorAxisAu)) {
        if (
          isPositiveFiniteCatalogValue(orbitalPeriodDays) &&
          isPositiveFiniteCatalogValue(hostMass)
        ) {
          semiMajorAxisAu = Math.cbrt(hostMass * (orbitalPeriodDays / 365.25) ** 2);
          semiMajorAxisSource = 'Calculated from Kepler’s third law';
        } else {
          semiMajorAxisAu = 0.08 * (systemIndex + 1) ** 1.45;
          semiMajorAxisSource = 'Illustrative map spacing';
        }
      }
      if (!isPositiveFiniteCatalogValue(orbitalPeriodDays)) {
        if (
          isPositiveFiniteCatalogValue(hostMass) &&
          semiMajorAxisSource !== 'Illustrative map spacing'
        ) {
          orbitalPeriodDays = 365.25 * Math.sqrt(semiMajorAxisAu ** 3 / hostMass);
          orbitalPeriodSource = 'Calculated from Kepler’s third law';
        } else {
          orbitalPeriodDays = 18 * (systemIndex + 1) ** 1.65;
          orbitalPeriodSource = 'Illustrative map timing';
        }
      }

      return {
        semiMajorAxisAu,
        orbitalPeriodDays,
        semiMajorAxisSource,
        orbitalPeriodSource,
      };
    });
  }

  private createOrbitDistanceScales(): Float64Array {
    const scales = new Float64Array(this.catalog.hostCount);
    const oneAuSceneUnits = this.coordinateSystem.toSceneDistance(
      1,
      'astronomical-unit',
      'stellar',
    );

    for (let hostIndex = 0; hostIndex < this.catalog.hostCount; hostIndex += 1) {
      const firstPlanetIndex = this.catalog.hostFirstPlanetIndices[hostIndex]!;
      const planetCount = this.catalog.hostPlanetCounts[hostIndex]!;
      let maximumAxis = 0;

      for (let offset = 0; offset < planetCount; offset += 1) {
        maximumAxis = Math.max(
          maximumAxis,
          this.resolvedOrbits[firstPlanetIndex + offset]!.semiMajorAxisAu,
        );
      }
      scales[hostIndex] = clamp(
        SYSTEM_MAXIMUM_ORBIT_RADIUS / Math.max(maximumAxis * oneAuSceneUnits, Number.EPSILON),
        MINIMUM_ORBIT_DISTANCE_SCALE,
        MAXIMUM_ORBIT_DISTANCE_SCALE,
      );
    }

    return scales;
  }

  private getGalacticPosition(index: number): GalacticPosition {
    const offset = index * 3;

    return {
      x: this.galacticPositions[offset]!,
      y: this.galacticPositions[offset + 1]!,
      z: this.galacticPositions[offset + 2]!,
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

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
