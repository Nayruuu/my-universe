import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  ExoplanetHostBatch,
  getExoplanetHostDrawFraction,
  getExoplanetHostTargetOpacity,
} from './exoplanet-host-batch';

describe('ExoplanetHostBatch', () => {
  it('renders every unlinked host in one GPU batch with a scale-aware exoplanet signature', () => {
    const batch = createBatch();
    const geometry = batch.points.geometry;

    expect(batch.root.children).toEqual([batch.points, batch.selectionPoint]);
    expect(geometry.getAttribute('position').count).toBe(2);
    expect(geometry.getAttribute('starColor').count).toBe(2);
    expect(geometry.getAttribute('pointSize').count).toBe(2);
    expect(geometry.getAttribute('pointAlpha').count).toBe(2);
    expect(geometry.getAttribute('surfaceCellScale').count).toBe(2);
    expect(geometry.getAttribute('surfaceContrast').count).toBe(2);
    expect(geometry.getAttribute('surfaceCorona').count).toBe(2);
    expect(geometry.getAttribute('surfaceSeed').count).toBe(2);
    expect(batch.points.material.blending).toBe(THREE.AdditiveBlending);
    expect(batch.points.material.fragmentShader).toContain('exoplanetRing');
    expect(batch.points.material.fragmentShader).toContain('hostSignatureStrength');
    expect(batch.points.material.fragmentShader).toContain('proceduralPhotosphere');
    expect(batch.points.material.fragmentShader).toContain('stellarSurfaceNoise');
    expect(batch.points.material.fragmentShader).toContain('illustrativeStellarTint');
    expect(batch.points.material.vertexShader).toContain('smoothstep(12.0, 22.0');
    expect(batch.points.userData).toMatchObject({
      catalogCount: 2,
      renderedHostCount: 2,
      scientificConfidence: 'observed',
      appearanceConfidence: 'illustrative',
      source: 'NASA Exoplanet Archive · PSCompPars',
      visualStyle: 'procedural-stellar-photosphere-with-exoplanet-ring',
      hostSignatureTreatment: 'suppressed-at-planetary-scale',
    });
    expect(batch.points.userData['objectIds']).toHaveLength(2);
    const pickingLayers = new THREE.Layers();

    pickingLayers.set(PICKING_LAYER);
    expect(batch.points.layers.test(pickingLayers)).toBe(true);
    expect(batch.selectionPoint.layers.test(pickingLayers)).toBe(true);
    batch.dispose();
  });

  it('does not duplicate curated hosts already rendered as detailed objects', () => {
    const featured = featuredHost();
    const registry = new ExoplanetCatalogRegistry(catalog(), new CoordinateSystem(), [featured]);
    const batch = new ExoplanetHostBatch(registry);

    expect(batch.points.geometry.getAttribute('position').count).toBe(1);
    expect(batch.points.userData['objectIds']).not.toContain(featured.id);
    expect(batch.points.userData['renderedHostCount']).toBe(1);
    batch.dispose();
  });

  it('applies quality budgets without creating more draw calls', () => {
    expect(getExoplanetHostDrawFraction('low')).toBeLessThan(
      getExoplanetHostDrawFraction('medium'),
    );
    expect(getExoplanetHostDrawFraction('medium')).toBeLessThan(
      getExoplanetHostDrawFraction('high'),
    );
    const batch = createBatch('low');

    expect(batch.points.geometry.drawRange.count).toBe(1);
    const lowSurfaceDetail = batch.points.material.uniforms['surfaceDetail']!.value as number;

    batch.setQuality('high');
    const highSurfaceDetail = batch.points.material.uniforms['surfaceDetail']!.value as number;

    expect(batch.points.geometry.drawRange.count).toBe(2);
    expect(highSurfaceDetail).toBeGreaterThan(lowSurfaceDetail);
    expect(batch.root.children).toHaveLength(2);
    batch.dispose();
  });

  it('fades continuously between the stellar neighborhood and galactic map', () => {
    expect(getExoplanetHostTargetOpacity(0)).toBeCloseTo(0.38);
    expect(getExoplanetHostTargetOpacity(2)).toBeCloseTo(0.68);
    expect(getExoplanetHostTargetOpacity(2.5)).toBeGreaterThan(0);
    expect(getExoplanetHostTargetOpacity(2.5)).toBeLessThan(0.68);
    expect(getExoplanetHostTargetOpacity(3)).toBe(0);
    expect(getExoplanetHostTargetOpacity(4)).toBe(0);
    const batch = createBatch();

    batch.updateLod(0, 10);
    expect(batch.points.material.uniforms['hostSignatureStrength']!.value).toBeCloseTo(0, 4);
    expect(batch.points.material.uniforms['pointScale']!.value).toBeCloseTo(0.62, 4);
    batch.updateLod(2, 10);
    expect(batch.points.visible).toBe(true);
    expect(batch.visibleCount).toBe(2);
    expect(batch.points.material.uniforms['catalogOpacity']!.value).toBeCloseTo(0.68, 4);
    expect(batch.points.material.uniforms['hostSignatureStrength']!.value).toBeCloseTo(0.38, 4);
    batch.updateLod(2, 0.016);
    expect(batch.points.visible).toBe(true);
    batch.updateLod(3, 10);
    expect(batch.points.visible).toBe(false);
    expect(batch.points.material.uniforms['hostSignatureStrength']!.value).toBeCloseTo(0, 4);
    batch.updateLod(4, 10);
    expect(batch.points.visible).toBe(false);
    expect(batch.visibleCount).toBe(0);
    batch.dispose();
  });

  it('ne transforme pas la limite du catalogue héliocentrique en boule de points', () => {
    const batch = createBatch();
    const sphere = batch.points.geometry.boundingSphere!;
    const radius = sphere.radius + sphere.center.length();

    batch.updateLod(2, 10, new THREE.Vector3(radius * 0.9, 0, 0));
    expect(batch.visibleCount).toBe(0);
    expect(batch.points.userData['observerBoundaryOpacity']).toBe(0);

    batch.updateLod(2, 10, new THREE.Vector3(0, 0, 0));
    expect(batch.visibleCount).toBe(2);
    expect(batch.points.userData['observerBoundaryOpacity']).toBe(1);
    batch.dispose();
  });

  it('reuses one marker for hosts and planets, including records outside the quality budget', () => {
    const registry = new ExoplanetCatalogRegistry(catalog(), new CoordinateSystem());
    const batch = new ExoplanetHostBatch(registry, 'low');
    const planetId = registry.getPlanetObjectId(2);
    const hostId = registry.getHostObjectId(1);

    batch.updateLod(2, 10);
    batch.select(planetId);
    expect(batch.selectionPoint.visible).toBe(true);
    expect(batch.selectionPoint.userData['objectId']).toBe(planetId);
    expect(batch.selectionPoint.position.toArray()).toEqual(
      registry.getLocalPosition(hostId)?.toArray(),
    );
    expect(batch.getPickables()).toEqual([batch.selectionPoint, batch.points]);
    expect(batch.getWorldPosition(planetId)).not.toBeNull();
    expect(batch.isObjectVisibleForLabels(planetId)).toBe(true);

    batch.select(null);
    expect(batch.selectionPoint.visible).toBe(false);
    batch.select('missing');
    expect(batch.selectionPoint.visible).toBe(false);
    expect(batch.getWorldPosition('missing')).toBeNull();
    expect(batch.isObjectVisibleForLabels('missing')).toBeNull();
    batch.dispose();
  });

  it('bounds display controls and disposes every GPU resource', () => {
    const batch = createBatch();
    const pointGeometryDispose = vi.spyOn(batch.points.geometry, 'dispose');
    const pointMaterialDispose = vi.spyOn(batch.points.material, 'dispose');
    const selectionGeometryDispose = vi.spyOn(batch.selectionPoint.geometry, 'dispose');
    const selectionMaterialDispose = vi.spyOn(batch.selectionPoint.material, 'dispose');

    batch.setPixelRatio(0.1);
    expect(batch.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    batch.setPhotographicRadiance(2);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(1.5);
    batch.setPhotographicRadiance(0);
    expect(batch.points.material.uniforms['radiance']!.value).toBe(0.5);
    batch.dispose();
    expect(pointGeometryDispose).toHaveBeenCalledOnce();
    expect(pointMaterialDispose).toHaveBeenCalledOnce();
    expect(selectionGeometryDispose).toHaveBeenCalledOnce();
    expect(selectionMaterialDispose).toHaveBeenCalledOnce();
  });

  it('encodes every stellar temperature band and the missing-magnitude fallback', () => {
    const variants = [
      { temperatures: [12_000, 8_000], magnitudes: [1, 2] },
      { temperatures: [6_500, 5_200], magnitudes: [3, 4] },
      { temperatures: [4_000, Number.NaN], magnitudes: [5, Number.NaN] },
    ] as const;

    for (const variant of variants) {
      const batch = new ExoplanetHostBatch(
        new ExoplanetCatalogRegistry(
          catalogWith({
            hostTemperaturesKelvin: new Float32Array(variant.temperatures),
            hostApparentMagnitudes: new Float32Array(variant.magnitudes),
          }),
          new CoordinateSystem(),
        ),
      );
      const colors = batch.points.geometry.getAttribute('starColor');
      const alphas = batch.points.geometry.getAttribute('pointAlpha');
      const cellScales = batch.points.geometry.getAttribute('surfaceCellScale');
      const contrasts = batch.points.geometry.getAttribute('surfaceContrast');
      const coronae = batch.points.geometry.getAttribute('surfaceCorona');

      expect(colors.count).toBe(2);
      expect(alphas.count).toBe(2);
      expect(cellScales.count).toBe(2);
      expect(Array.from(colors.array)).not.toContain(Number.NaN);
      expect(Array.from(alphas.array)).not.toContain(Number.NaN);
      expect(Array.from(cellScales.array)).not.toContain(Number.NaN);
      expect(Array.from(contrasts.array)).not.toContain(Number.NaN);
      expect(Array.from(coronae.array)).not.toContain(Number.NaN);
      batch.dispose();
    }

    const temperatureOnlyBatch = new ExoplanetHostBatch(
      new ExoplanetCatalogRegistry(
        catalogWith({
          hostSpectralTypes: [null, null],
          hostTemperaturesKelvin: new Float32Array([12_000, 1_800]),
        }),
        new CoordinateSystem(),
      ),
    );
    const temperatureProfiles = temperatureOnlyBatch.points.geometry.getAttribute('surfaceProfile');

    expect(Array.from(temperatureProfiles.array)).toEqual([0, 7]);
    temperatureOnlyBatch.dispose();
  });
});

function createBatch(quality: 'low' | 'medium' | 'high' = 'high'): ExoplanetHostBatch {
  return new ExoplanetHostBatch(
    new ExoplanetCatalogRegistry(catalog(), new CoordinateSystem()),
    quality,
  );
}

function featuredHost(): SpaceObject {
  return {
    id: 'nearby-host',
    name: 'Nearby Host',
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 0, 0], unit: 'parsec' },
    metadata: { sourceTable: 'PSCompPars', exoplanetHost: true },
  };
}

function catalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 3,
    hostNames: ['Nearby Host', 'Distant Host'],
    hostAliases: [[], []],
    hostSpectralTypes: ['G2 V', 'M4'],
    hostFirstPlanetIndices: new Uint32Array([0, 2]),
    hostPlanetCounts: new Uint16Array([2, 1]),
    hostStarCounts: new Uint8Array([1, 1]),
    hostCircumbinaryFlags: new Uint8Array([0, 0]),
    hostRightAscensionDegrees: new Float64Array([0, 120]),
    hostDeclinationDegrees: new Float64Array([0, 45]),
    hostDistancesParsec: new Float64Array([10, 30]),
    hostTemperaturesKelvin: new Float32Array([5_700, 3_200]),
    hostRadiiSolar: new Float32Array([1, 0.3]),
    hostMassesSolar: new Float32Array([1, 0.2]),
    hostApparentMagnitudes: new Float32Array([8, 14]),
    planetNames: ['Nearby Host b', 'Nearby Host c', 'Distant Host b'],
    planetLetters: ['b', 'c', 'b'],
    planetDiscoveryMethods: ['Transit', 'Radial Velocity', 'Imaging'],
    planetDiscoveryFacilities: ['Kepler', 'HARPS', 'Test'],
    planetMassProvenances: ['Mass', 'Mass', 'Mass'],
    planetHostIndices: new Uint32Array([0, 0, 1]),
    planetOrbitalPeriodsDays: new Float64Array([10, 20, 30]),
    planetSemiMajorAxesAu: new Float64Array([0.1, 0.2, 0.3]),
    planetRadiiEarth: new Float32Array([1.1, 2.4, 6]),
    planetMassesEarth: new Float32Array([1.3, 6.2, 20]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([500, 280, 200]),
    planetEccentricities: new Float32Array([0.02, 0.1, 0.2]),
    planetInclinationsDegrees: new Float32Array([89, 88, 70]),
    planetInsolationsEarth: new Float32Array([3, 1.1, 0.4]),
    planetDiscoveryYears: new Uint16Array([2020, 2021, 2022]),
    planetControversialFlags: new Uint8Array([0, 0, 0]),
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
      counts: { hosts: 2, planets: 3, positionedHosts: 2, positionedPlanets: 3 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}

function catalogWith(overrides: Partial<ExoplanetCatalog>): ExoplanetCatalog {
  return { ...catalog(), ...overrides };
}
