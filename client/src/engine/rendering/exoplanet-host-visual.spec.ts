import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createExoplanetHostVisual } from './exoplanet-host-visual';

describe('createExoplanetHostVisual', () => {
  it('construit les photosphères GPU et les index des hôtes NASA rendus', () => {
    const registry = new ExoplanetCatalogRegistry(createCatalog(), new CoordinateSystem());
    const visual = createExoplanetHostVisual(registry);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(visual.points.geometry.getAttribute('position').count).toBe(2);
    expect(visual.points.geometry.getAttribute('surfaceProfile').count).toBe(2);
    expect(visual.points.layers.test(pickingLayers)).toBe(true);
    expect(visual.selectionPoint.layers.test(pickingLayers)).toBe(true);
    expect(visual.renderedHostIndices).toEqual([0, 1]);
    expect(visual.visibleIndices).toEqual(new Uint8Array([0, 0]));
    expect(visual.points.userData).toMatchObject({
      catalogCount: 2,
      renderedHostCount: 2,
      planetCount: 2,
      scientificConfidence: 'observed',
      source: 'NASA Exoplanet Archive · PSCompPars',
      objectIds: registry.hostObjectIds,
    });
  });
});

function createCatalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 2,
    hostNames: ['Host A', 'Host B'],
    hostAliases: [[], []],
    hostSpectralTypes: ['G2 V', 'M4'],
    hostFirstPlanetIndices: new Uint32Array([0, 1]),
    hostPlanetCounts: new Uint16Array([1, 1]),
    hostStarCounts: new Uint8Array([1, 1]),
    hostCircumbinaryFlags: new Uint8Array([0, 0]),
    hostRightAscensionDegrees: new Float64Array([0, 120]),
    hostDeclinationDegrees: new Float64Array([0, 45]),
    hostDistancesParsec: new Float64Array([10, 30]),
    hostTemperaturesKelvin: new Float32Array([5_700, 3_200]),
    hostRadiiSolar: new Float32Array([1, 0.3]),
    hostMassesSolar: new Float32Array([1, 0.2]),
    hostApparentMagnitudes: new Float32Array([8, 14]),
    planetNames: ['Host A b', 'Host B b'],
    planetLetters: ['b', 'b'],
    planetDiscoveryMethods: ['Transit', 'Radial Velocity'],
    planetDiscoveryFacilities: ['Kepler', 'HARPS'],
    planetMassProvenances: ['Mass', 'Mass'],
    planetHostIndices: new Uint32Array([0, 1]),
    planetOrbitalPeriodsDays: new Float64Array([10, 20]),
    planetSemiMajorAxesAu: new Float64Array([0.1, 0.2]),
    planetRadiiEarth: new Float32Array([1.1, 2.4]),
    planetMassesEarth: new Float32Array([1.3, 6.2]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([500, 280]),
    planetEccentricities: new Float32Array([0.02, 0.1]),
    planetInclinationsDegrees: new Float32Array([89, 88]),
    planetInsolationsEarth: new Float32Array([3, 1.1]),
    planetDiscoveryYears: new Uint16Array([2020, 2021]),
    planetControversialFlags: new Uint8Array([0, 0]),
    metadata: {
      version: '1.0.0',
      format: 'exoplanet-catalog-v1',
      source: {
        name: 'NASA Exoplanet Archive',
        url: 'https://exoplanetarchive.ipac.caltech.edu/',
        tapUrl: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
        table: 'PSCompPars',
        query: 'select ... from pscomppars',
        snapshotDate: '2026-08-05',
        sha256: 'a'.repeat(64),
      },
      counts: { hosts: 2, planets: 2, positionedHosts: 2, positionedPlanets: 2 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}
