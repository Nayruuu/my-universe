export interface ExoplanetCatalogMetadata {
  readonly version: string;
  readonly format: 'exoplanet-catalog-v1';
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly tapUrl: string;
    readonly table: 'PSCompPars';
    readonly query: string;
    readonly snapshotDate: string;
    readonly sha256: string;
  };
  readonly counts: {
    readonly hosts: number;
    readonly planets: number;
    readonly positionedHosts: number;
    readonly positionedPlanets: number;
  };
  readonly missingDistanceFallbackParsec: number;
}

export interface ExoplanetCatalog {
  readonly hostCount: number;
  readonly planetCount: number;
  readonly hostNames: readonly string[];
  readonly hostAliases: readonly (readonly string[])[];
  readonly hostSpectralTypes: readonly (string | null)[];
  readonly hostFirstPlanetIndices: Uint32Array;
  readonly hostPlanetCounts: Uint16Array;
  readonly hostStarCounts: Uint8Array;
  readonly hostCircumbinaryFlags: Uint8Array;
  readonly hostRightAscensionDegrees: Float64Array;
  readonly hostDeclinationDegrees: Float64Array;
  readonly hostDistancesParsec: Float64Array;
  readonly hostTemperaturesKelvin: Float32Array;
  readonly hostRadiiSolar: Float32Array;
  readonly hostMassesSolar: Float32Array;
  readonly hostApparentMagnitudes: Float32Array;
  readonly planetNames: readonly string[];
  readonly planetLetters: readonly string[];
  readonly planetDiscoveryMethods: readonly string[];
  readonly planetDiscoveryFacilities: readonly string[];
  readonly planetMassProvenances: readonly string[];
  readonly planetHostIndices: Uint32Array;
  readonly planetOrbitalPeriodsDays: Float64Array;
  readonly planetSemiMajorAxesAu: Float64Array;
  readonly planetRadiiEarth: Float32Array;
  readonly planetMassesEarth: Float32Array;
  readonly planetEquilibriumTemperaturesKelvin: Float32Array;
  readonly planetEccentricities: Float32Array;
  readonly planetInclinationsDegrees: Float32Array;
  readonly planetInsolationsEarth: Float32Array;
  readonly planetDiscoveryYears: Uint16Array;
  readonly planetControversialFlags: Uint8Array;
  readonly metadata: ExoplanetCatalogMetadata;
}
