import * as THREE from 'three';
import { SearchEntry, SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import { convertDistance } from '../coordinates/unit-conversion';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import type { LabelObject } from './label-manager';

const J2000_JULIAN_DAY = 2_451_545;
const EARTH_RADIUS_KILOMETERS = 6_371;
const EARTH_MASS_KILOGRAMS = 5.9722e24;
const SOLAR_RADIUS_KILOMETERS = 695_700;
const SOLAR_MASS_KILOGRAMS = 1.98847e30;
const DEFAULT_MAXIMUM_LABEL_RANK = 1_000;
const SYSTEM_MAXIMUM_ORBIT_RADIUS = 18;
const MINIMUM_ORBIT_DISTANCE_SCALE = 200;
const MAXIMUM_ORBIT_DISTANCE_SCALE = 50_000;
const TEMPERATE_MINIMUM_KELVIN = 180;
const TEMPERATE_MAXIMUM_KELVIN = 320;
const TEMPERATE_MAXIMUM_RADIUS_EARTH = 2.5;

export const EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE =
  'Illustrative radial depth; NASA publishes the sky direction but no system distance';

type CatalogObjectKind = 'host' | 'planet';

interface ResolvedOrbit {
  readonly semiMajorAxisAu: number;
  readonly orbitalPeriodDays: number;
  readonly semiMajorAxisSource: string;
  readonly orbitalPeriodSource: string;
}

export class ExoplanetCatalogRegistry {
  public readonly hostObjectIds: readonly string[];
  public readonly planetObjectIds: readonly string[];
  public readonly renderPositions: Float32Array;
  public readonly activeObjectCount = 0;

  private readonly hostIndexByObjectId = new Map<string, number>();
  private readonly planetIndexByObjectId = new Map<string, number>();
  private readonly linkedObjectIds = new Set<string>();
  private readonly definitions = new Map<string, SpaceObject>();
  private readonly resolvedOrbits: readonly ResolvedOrbit[];
  private readonly orbitDistanceScales: Float64Array;
  private readonly labelHostIndices: readonly number[];
  private searchEntries: readonly SearchEntry[] | null = null;

  constructor(
    public readonly catalog: ExoplanetCatalog,
    private readonly coordinateSystem: CoordinateSystem,
    featuredObjects: readonly SpaceObject[] = [],
  ) {
    const featuredHosts = createFeaturedObjectMap(featuredObjects, 'star');
    const featuredPlanets = createFeaturedObjectMap(featuredObjects, 'exoplanet');

    this.hostObjectIds = catalog.hostNames.map((name) => {
      const featured = findFeaturedObject(featuredHosts, name);

      if (featured) {
        this.linkedObjectIds.add(featured.id);
      }

      return featured?.id ?? createNasaCatalogObjectId('host', name);
    });
    this.planetObjectIds = catalog.planetNames.map((name) => {
      const featured = findFeaturedObject(featuredPlanets, name);

      if (featured) {
        this.linkedObjectIds.add(featured.id);
      }

      return featured?.id ?? createNasaCatalogObjectId('planet', name);
    });
    this.assertUniqueObjectIds();
    this.renderPositions = this.createRenderPositions();
    this.resolvedOrbits = this.createResolvedOrbits();
    this.orbitDistanceScales = this.createOrbitDistanceScales();

    for (let index = 0; index < catalog.hostCount; index += 1) {
      this.hostIndexByObjectId.set(this.hostObjectIds[index]!, index);
    }
    for (let index = 0; index < catalog.planetCount; index += 1) {
      this.planetIndexByObjectId.set(this.planetObjectIds[index]!, index);
    }

    this.labelHostIndices = this.createLabelHostIndices();
  }

  public has(objectId: string): boolean {
    return this.hostIndexByObjectId.has(objectId) || this.planetIndexByObjectId.has(objectId);
  }

  public isHost(objectId: string): boolean {
    return this.hostIndexByObjectId.has(objectId);
  }

  public getHostObjectId(index: number): string {
    const objectId = this.hostObjectIds[index];

    if (!objectId) {
      throw new Error(`Indice d’hôte exoplanétaire hors limites : ${index}.`);
    }

    return objectId;
  }

  public getHostIndex(objectId: string): number | null {
    const directIndex = this.hostIndexByObjectId.get(objectId);

    if (directIndex !== undefined) {
      return directIndex;
    }
    const planetIndex = this.planetIndexByObjectId.get(objectId);

    return planetIndex === undefined ? null : this.catalog.planetHostIndices[planetIndex]!;
  }

  public getRenderableHostIndices(): readonly number[] {
    return this.labelHostIndices;
  }

  public getPlanetObjectId(index: number): string {
    const objectId = this.planetObjectIds[index];

    if (!objectId) {
      throw new Error(`Indice d’exoplanète hors limites : ${index}.`);
    }

    return objectId;
  }

  public getHostIdForObject(objectId: string): string | null {
    const hostIndex = this.hostIndexByObjectId.get(objectId);

    if (hostIndex !== undefined) {
      return this.hostObjectIds[hostIndex]!;
    }
    const planetIndex = this.planetIndexByObjectId.get(objectId);

    return planetIndex === undefined
      ? null
      : this.hostObjectIds[this.catalog.planetHostIndices[planetIndex]!]!;
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    const cached = this.definitions.get(objectId);

    if (cached) {
      return cached;
    }
    const hostIndex = this.hostIndexByObjectId.get(objectId);
    const planetIndex = this.planetIndexByObjectId.get(objectId);
    const definition =
      hostIndex !== undefined
        ? this.createHostDefinition(hostIndex)
        : planetIndex !== undefined
          ? this.createPlanetDefinition(planetIndex)
          : undefined;

    if (definition) {
      this.definitions.set(objectId, definition);
    }

    return definition;
  }

  public createSystemObjects(objectId: string): readonly SpaceObject[] {
    const hostId = this.getHostIdForObject(objectId);

    if (!hostId) {
      return [];
    }
    const hostIndex = this.hostIndexByObjectId.get(hostId)!;
    const host = this.createHostDefinition(hostIndex);
    const firstPlanetIndex = this.catalog.hostFirstPlanetIndices[hostIndex]!;
    const planetCount = this.catalog.hostPlanetCounts[hostIndex]!;
    const planets = Array.from({ length: planetCount }, (_, offset) =>
      this.createPlanetDefinition(firstPlanetIndex + offset),
    );

    return [host, ...planets];
  }

  public getLocalPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const hostId = this.getHostIdForObject(objectId);

    if (!hostId) {
      return null;
    }
    const hostIndex = this.hostIndexByObjectId.get(hostId)!;

    return target.fromArray(this.renderPositions, hostIndex * 3);
  }

  public getSearchEntries(): readonly SearchEntry[] {
    this.searchEntries ??= [
      ...this.catalog.hostNames.flatMap((_, index) =>
        this.linkedObjectIds.has(this.hostObjectIds[index]!)
          ? []
          : [this.createHostSearchEntry(index)],
      ),
      ...this.catalog.planetNames.flatMap((_, index) =>
        this.linkedObjectIds.has(this.planetObjectIds[index]!)
          ? []
          : [this.createPlanetSearchEntry(index)],
      ),
    ];

    return this.searchEntries;
  }

  public getLabelObjects(maximumRank = DEFAULT_MAXIMUM_LABEL_RANK): readonly LabelObject[] {
    const limit = Math.min(this.labelHostIndices.length, Math.max(0, Math.floor(maximumRank)));

    return this.labelHostIndices.slice(0, limit).map((hostIndex, rank) => ({
      id: this.hostObjectIds[hostIndex]!,
      name: this.catalog.hostNames[hostIndex]!,
      type: 'star' as const,
      metadata: {
        exoplanetHost: true,
        exoplanetHostRank: rank,
        planetCount: this.catalog.hostPlanetCounts[hostIndex]!,
        ...(finiteMetadata('distanceParsec', this.catalog.hostDistancesParsec[hostIndex]!) ?? {}),
      },
    }));
  }

  private createRenderPositions(): Float32Array {
    const positions = new Float32Array(this.catalog.hostCount * 3);

    for (let index = 0; index < this.catalog.hostCount; index += 1) {
      const rightAscension = degreesToRadians(this.catalog.hostRightAscensionDegrees[index]!);
      const declination = degreesToRadians(this.catalog.hostDeclinationDegrees[index]!);
      const publishedDistance = this.catalog.hostDistancesParsec[index]!;
      const distance = Number.isFinite(publishedDistance)
        ? publishedDistance
        : this.catalog.metadata.missingDistanceFallbackParsec;
      const equatorial = {
        x: distance * Math.cos(declination) * Math.cos(rightAscension),
        y: distance * Math.cos(declination) * Math.sin(rightAscension),
        z: distance * Math.sin(declination),
      };
      const galactic = equatorialJ2000ToGalacticScene(equatorial);
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

      if (!isPositiveFinite(semiMajorAxisAu)) {
        if (isPositiveFinite(orbitalPeriodDays) && isPositiveFinite(hostMass)) {
          semiMajorAxisAu = Math.cbrt(hostMass * (orbitalPeriodDays / 365.25) ** 2);
          semiMajorAxisSource = 'Calculated from Kepler’s third law';
        } else {
          semiMajorAxisAu = 0.08 * (systemIndex + 1) ** 1.45;
          semiMajorAxisSource = 'Illustrative map spacing';
        }
      }
      if (!isPositiveFinite(orbitalPeriodDays)) {
        if (isPositiveFinite(hostMass) && semiMajorAxisSource !== 'Illustrative map spacing') {
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

  private createHostDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const distanceParsec = catalog.hostDistancesParsec[index]!;
    const mapDistance = Number.isFinite(distanceParsec)
      ? distanceParsec
      : catalog.metadata.missingDistanceFallbackParsec;
    const rightAscension = degreesToRadians(catalog.hostRightAscensionDegrees[index]!);
    const declination = degreesToRadians(catalog.hostDeclinationDegrees[index]!);
    const equatorial = {
      x: mapDistance * Math.cos(declination) * Math.cos(rightAscension),
      y: mapDistance * Math.cos(declination) * Math.sin(rightAscension),
      z: mapDistance * Math.sin(declination),
    };
    const galactic = equatorialJ2000ToGalacticScene(equatorial);
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
      physical: compactObject({
        radiusKm: multiplyFinite(radiusSolar, SOLAR_RADIUS_KILOMETERS),
        massKg: multiplyFinite(massSolar, SOLAR_MASS_KILOGRAMS),
        temperatureK: finiteValue(temperature),
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
      metadata: compactObject({
        source: 'NASA Exoplanet Archive · PSCompPars',
        sourceUrl: nasaOverviewUrl(catalog.hostNames[index]!),
        sourceTable: catalog.metadata.source.table,
        catalogSnapshotDate: catalog.metadata.source.snapshotDate,
        exoplanetHost: true,
        rightAscensionDegrees: catalog.hostRightAscensionDegrees[index]!,
        declinationDegrees: catalog.hostDeclinationDegrees[index]!,
        distancePc: finiteValue(distanceParsec),
        distanceLy: Number.isFinite(distanceParsec)
          ? convertDistance(distanceParsec, 'parsec', 'light-year')
          : undefined,
        apparentMagnitude: finiteValue(catalog.hostApparentMagnitudes[index]!),
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

  private createPlanetDefinition(index: number): SpaceObject {
    const catalog = this.catalog;
    const hostIndex = catalog.planetHostIndices[index]!;
    const hostId = this.hostObjectIds[hostIndex]!;
    const orbit = this.resolvedOrbits[index]!;
    const radiusEarth = catalog.planetRadiiEarth[index]!;
    const massEarth = catalog.planetMassesEarth[index]!;
    const equilibriumTemperature = catalog.planetEquilibriumTemperaturesKelvin[index]!;
    const eccentricity = catalog.planetEccentricities[index]!;
    const inclination = catalog.planetInclinationsDegrees[index]!;
    const insolation = catalog.planetInsolationsEarth[index]!;
    const distanceParsec = catalog.hostDistancesParsec[hostIndex]!;
    const missingDistance = !Number.isFinite(distanceParsec);
    const hash = stableHash(catalog.planetNames[index]!);
    const colors = planetColors(radiusEarth, equilibriumTemperature);

    return {
      id: this.planetObjectIds[index]!,
      name: catalog.planetNames[index]!,
      aliases: [],
      type: 'exoplanet',
      parentId: hostId,
      referenceFrame: 'stellar',
      scientificConfidence: 'observed',
      description:
        'Exoplanète confirmée recensée dans la table composite PSCompPars de la NASA Exoplanet Archive. Sa surface et son apparence ne sont pas directement observées.',
      physical: compactObject({
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
      metadata: compactObject({
        source: 'NASA Exoplanet Archive · PSCompPars',
        sourceUrl: nasaOverviewUrl(catalog.hostNames[hostIndex]!),
        sourceTable: catalog.metadata.source.table,
        catalogSnapshotDate: catalog.metadata.source.snapshotDate,
        confirmationStatus: 'Confirmed Planet',
        detectionMethod: catalog.planetDiscoveryMethods[index]!,
        discoveryFacility: catalog.planetDiscoveryFacilities[index]!,
        discoveryYear: nonZeroValue(catalog.planetDiscoveryYears[index]!),
        distanceLy: Number.isFinite(distanceParsec)
          ? convertDistance(distanceParsec, 'parsec', 'light-year')
          : undefined,
        semiMajorAxisAu: finiteValue(catalog.planetSemiMajorAxesAu[index]!),
        orbitalPeriodDays: finiteValue(catalog.planetOrbitalPeriodsDays[index]!),
        equilibriumTemperatureK: finiteValue(equilibriumTemperature),
        orbitalInclinationDegrees: finiteValue(inclination),
        eccentricity: finiteValue(eccentricity),
        insolationEarth: finiteValue(insolation),
        radiusEarth: finiteValue(radiusEarth),
        massEarth: finiteValue(massEarth),
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

  private createHostSearchEntry(index: number): SearchEntry {
    const distance = this.catalog.hostDistancesParsec[index]!;

    return {
      id: this.hostObjectIds[index]!,
      name: this.catalog.hostNames[index]!,
      aliases: this.catalog.hostAliases[index]!,
      type: 'star',
      parentName: 'Voie lactée',
      keywords: ['NASA Exoplanet Archive', 'étoile hôte', 'exoplanète'],
      metadata: compactObject({
        exoplanetHost: true,
        distanceParsec: finiteValue(distance),
        planetCount: this.catalog.hostPlanetCounts[index]!,
      }),
    };
  }

  private createPlanetSearchEntry(index: number): SearchEntry {
    const hostIndex = this.catalog.planetHostIndices[index]!;
    const distance = this.catalog.hostDistancesParsec[hostIndex]!;
    const radius = this.catalog.planetRadiiEarth[index]!;
    const temperature = this.catalog.planetEquilibriumTemperaturesKelvin[index]!;
    const method = this.catalog.planetDiscoveryMethods[index]!;

    return {
      id: this.planetObjectIds[index]!,
      name: this.catalog.planetNames[index]!,
      aliases: [],
      type: 'exoplanet',
      parentName: this.catalog.hostNames[hostIndex]!,
      keywords: ['NASA Exoplanet Archive', 'exoplanète confirmée', method],
      metadata: compactObject({
        distanceParsec: finiteValue(distance),
        radiusEarth: roundedFiniteValue(radius),
        discoveryMethod: method,
        discoveryYear: nonZeroValue(this.catalog.planetDiscoveryYears[index]!),
        temperateCandidate: isTemperateCandidate(radius, temperature),
        controversial: this.catalog.planetControversialFlags[index] === 1,
      }),
    };
  }

  private createLabelHostIndices(): readonly number[] {
    return Array.from({ length: this.catalog.hostCount }, (_, index) => index)
      .filter((index) => !this.linkedObjectIds.has(this.hostObjectIds[index]!))
      .sort((left, right) => compareHostRank(this.catalog, left, right));
  }

  private assertUniqueObjectIds(): void {
    const identifiers = [...this.hostObjectIds, ...this.planetObjectIds];

    if (new Set(identifiers).size !== identifiers.length) {
      throw new Error('Le catalogue d’exoplanètes contient des identifiants de carte dupliqués.');
    }
  }
}

export function createNasaCatalogObjectId(kind: CatalogObjectKind, name: string): string {
  const slug =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('en')
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-|-$/gu, '') || 'object';

  return `nea-${kind}-${slug}-${stableHash(`${kind}:${name}`).toString(36)}`;
}

function createFeaturedObjectMap(
  objects: readonly SpaceObject[],
  type: 'star' | 'exoplanet',
): ReadonlyMap<string, SpaceObject> {
  const map = new Map<string, SpaceObject>();

  for (const object of objects) {
    const isCatalogObject =
      object.type === type &&
      (object.metadata?.['sourceTable'] === 'PSCompPars' ||
        (type === 'star' && object.metadata?.['exoplanetHost'] === true));

    if (!isCatalogObject) {
      continue;
    }
    for (const name of [object.name, ...(object.aliases ?? [])]) {
      map.set(normalizeCatalogName(name), object);
    }
  }

  return map;
}

function findFeaturedObject(
  objects: ReadonlyMap<string, SpaceObject>,
  name: string,
): SpaceObject | undefined {
  return objects.get(normalizeCatalogName(name));
}

function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en');
}

function compareHostRank(catalog: ExoplanetCatalog, left: number, right: number): number {
  const leftDistance = finiteOrInfinity(catalog.hostDistancesParsec[left]!);
  const rightDistance = finiteOrInfinity(catalog.hostDistancesParsec[right]!);
  const leftMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[left]!);
  const rightMagnitude = finiteOrInfinity(catalog.hostApparentMagnitudes[right]!);

  return (
    leftDistance - rightDistance ||
    leftMagnitude - rightMagnitude ||
    catalog.hostNames[left]!.localeCompare(catalog.hostNames[right]!)
  );
}

function isTemperateCandidate(radiusEarth: number, temperatureKelvin: number): boolean {
  return (
    isPositiveFinite(radiusEarth) &&
    radiusEarth <= TEMPERATE_MAXIMUM_RADIUS_EARTH &&
    temperatureKelvin >= TEMPERATE_MINIMUM_KELVIN &&
    temperatureKelvin <= TEMPERATE_MAXIMUM_KELVIN
  );
}

function visualPlanetRadius(radiusEarth: number): number {
  return isPositiveFinite(radiusEarth)
    ? clamp(0.38 + Math.log1p(radiusEarth) * 0.2, 0.45, 0.95)
    : 0.55;
}

function planetColors(
  radiusEarth: number,
  temperatureKelvin: number,
): { readonly primary: string; readonly secondary: string } {
  if (isPositiveFinite(temperatureKelvin) && temperatureKelvin > 700) {
    return { primary: '#c97955', secondary: '#6f342d' };
  }
  if (isPositiveFinite(radiusEarth) && radiusEarth >= 6) {
    return { primary: '#d5b178', secondary: '#76604a' };
  }
  if (isPositiveFinite(radiusEarth) && radiusEarth >= 2.5) {
    return { primary: '#70a9bd', secondary: '#315b78' };
  }

  return { primary: '#6fb6a2', secondary: '#315d62' };
}

function stellarTemperatureColor(temperatureKelvin: number): string {
  if (!isPositiveFinite(temperatureKelvin)) {
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

function stableHash(value: string): number {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function finiteMetadata(key: string, value: number): Readonly<Record<string, number>> | undefined {
  return Number.isFinite(value) ? { [key]: value } : undefined;
}

function finiteValue(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function roundedFiniteValue(value: number): number | undefined {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : undefined;
}

function nonZeroValue(value: number): number | undefined {
  return value === 0 ? undefined : value;
}

function multiplyFinite(value: number, multiplier: number): number | undefined {
  return Number.isFinite(value) ? value * multiplier : undefined;
}

function compactObject<T extends Record<string, unknown>>(
  value: T,
): {
  [Key in keyof T]?: Exclude<T[Key], undefined>;
} {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [Key in keyof T]?: Exclude<T[Key], undefined>;
  };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteOrInfinity(value: number): number {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
