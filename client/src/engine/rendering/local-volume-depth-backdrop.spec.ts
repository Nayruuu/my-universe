import * as THREE from 'three';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import {
  getLocalVolumeDepthBackdropOpacity,
  LocalVolumeDepthBackdrop,
  projectCosmicGroupToLocalDepthShell,
} from './local-volume-depth-backdrop';

describe('LocalVolumeDepthBackdrop', () => {
  it('projette un échantillon calculé dans un unique batch GPU léger', () => {
    const backdrop = new LocalVolumeDepthBackdrop(registry(), 'high');
    const geometry = backdrop.points.geometry;

    expect(backdrop.points).toBeInstanceOf(THREE.Points);
    expect(backdrop.points.name).toBe('calculated-local-volume-depth-backdrop');
    expect(backdrop.points.userData).toMatchObject({
      catalogCount: 8,
      scientificConfidence: 'calculated',
      appearanceConfidence: 'illustrative',
      sceneRole: 'non-interactive-deep-sky-background',
      depthProjection: 'catalog-direction-preserving-radial-compression',
      visualProfile: 'inclined-multilobed-unresolved-group-light',
      source: 'Cosmicflows-4 · Tully et al. (2023)',
    });
    expect(geometry.getAttribute('position').count).toBe(8);
    expect(geometry.getAttribute('pointColor').count).toBe(8);
    expect(geometry.getAttribute('pointSize').count).toBe(8);
    expect(geometry.getAttribute('pointAlpha').count).toBe(8);
    expect(geometry.getAttribute('groupOrientation').count).toBe(8);
    expect(geometry.getAttribute('groupAxisRatio').count).toBe(8);
    expect(geometry.getAttribute('groupProfile').count).toBe(8);
    expect(geometry.getAttribute('groupProminence').count).toBe(8);
    expect(geometry.getAttribute('groupSeed').count).toBe(8);
    expect(geometry.drawRange.count).toBe(4);
    expect(backdrop.points.material.fragmentShader).toContain('float secondaryLobe');
    expect(backdrop.points.material.fragmentShader).toContain('mat2(');
    expect(backdrop.points.material.fragmentShader).toContain('if (radius > 1.0)');
    expect(backdrop.points.material.vertexShader).toContain('max(2.4');
    expect(backdrop.points.material.fragmentShader).toContain('float diffuseLight = exp(');
    expect(backdrop.points.material.blending).toBe(THREE.NormalBlending);
    expect(backdrop.visibleCount).toBe(0);

    const sizes = geometry.getAttribute('pointSize');
    const axisRatios = geometry.getAttribute('groupAxisRatio');

    expect(minimumAttributeValue(sizes)).toBeGreaterThanOrEqual(3.1);
    expect(maximumAttributeValue(sizes)).toBeGreaterThan(3.5);
    expect(minimumAttributeValue(axisRatios)).toBeGreaterThanOrEqual(0.3);
    expect(maximumAttributeValue(axisRatios)).toBeLessThanOrEqual(0.92);

    backdrop.setQuality('low');
    expect(geometry.drawRange.count).toBe(1);
    backdrop.setQuality('medium');
    expect(geometry.drawRange.count).toBe(2);
    backdrop.setQuality('high');
    expect(geometry.drawRange.count).toBe(4);
    backdrop.dispose();
  });

  it('préserve les directions Cosmicflows tout en comprimant la profondeur du LOD', () => {
    const projected = new THREE.Vector3();

    projectCosmicGroupToLocalDepthShell(3, 4, 0, 0, projected);
    expect(projected.x).toBeCloseTo(14_400, 8);
    expect(projected.y).toBeCloseTo(19_200, 8);
    expect(projected.z).toBe(0);
    expect(projectCosmicGroupToLocalDepthShell(0, 0, -8, 1, projected).toArray()).toEqual([
      0, 0, -56_000,
    ]);
    expect(projectCosmicGroupToLocalDepthShell(0, 0, 0, 0.5, projected).length()).toBe(0);
  });

  it('encadre le champ profond entre la Voie lactée et l’Univers proche', () => {
    expect(getLocalVolumeDepthBackdropOpacity(5_800)).toBe(0);
    expect(getLocalVolumeDepthBackdropOpacity(7_500)).toBeGreaterThan(0);
    expect(getLocalVolumeDepthBackdropOpacity(9_500)).toBeCloseTo(0.4, 5);
    expect(getLocalVolumeDepthBackdropOpacity(17_000)).toBeCloseTo(0.4, 5);
    expect(getLocalVolumeDepthBackdropOpacity(30_000)).toBeGreaterThan(0);
    expect(getLocalVolumeDepthBackdropOpacity(55_000)).toBe(0);
    expect(getLocalVolumeDepthBackdropOpacity(120_000)).toBe(0);

    const before = getLocalVolumeDepthBackdropOpacity(21_999);
    const after = getLocalVolumeDepthBackdropOpacity(22_001);

    expect(Math.abs(after - before)).toBeLessThan(0.000_001);
  });

  it('pilote qualité, radiance et visibilité sans rendre le fond interactif', () => {
    const backdrop = new LocalVolumeDepthBackdrop(registry(), 'high');

    backdrop.setPixelRatio(0.1);
    expect(backdrop.points.material.uniforms['pixelRatio']!.value).toBe(0.5);
    backdrop.setPixelRatio(4);
    expect(backdrop.points.material.uniforms['pixelRatio']!.value).toBe(1.5);
    backdrop.setPhotographicRadiance(0);
    expect(backdrop.points.material.uniforms['radiance']!.value).toBe(0.5);
    backdrop.setPhotographicRadiance(2);
    expect(backdrop.points.material.uniforms['radiance']!.value).toBe(1.5);

    backdrop.updateDistance(17_000, 10);
    expect(backdrop.points.visible).toBe(true);
    expect(backdrop.visibleCount).toBe(4);
    expect(backdrop.points.material.uniforms['opacity']!.value).toBeCloseTo(0.4, 5);

    backdrop.setEnabled(false);
    expect(backdrop.points.visible).toBe(false);
    expect(backdrop.visibleCount).toBe(0);
    backdrop.setEnabled(true);
    expect(backdrop.points.visible).toBe(true);

    backdrop.updateDistance(55_000, 10);
    expect(backdrop.points.visible).toBe(false);
    expect(backdrop.visibleCount).toBe(0);
    backdrop.dispose();
  });

  it('reste vide et libère ses ressources sans catalogue', () => {
    const backdrop = new LocalVolumeDepthBackdrop(registry(0), 'medium');
    const disposeGeometry = vi.spyOn(backdrop.points.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(backdrop.points.material, 'dispose');

    backdrop.updateDistance(17_000, 10);
    expect(backdrop.points.visible).toBe(false);
    expect(backdrop.points.geometry.drawRange.count).toBe(0);
    backdrop.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('conserve l’ordre du catalogue lorsque deux priorités sont identiques', () => {
    const duplicateRegistry = registry(2, true);
    const backdrop = new LocalVolumeDepthBackdrop(duplicateRegistry, 'high');
    const positions = backdrop.points.geometry.getAttribute('position');
    const expected = new Float32Array(6);
    const projected = new THREE.Vector3();

    projectCosmicGroupToLocalDepthShell(
      duplicateRegistry.renderPositions[0]!,
      duplicateRegistry.renderPositions[1]!,
      duplicateRegistry.renderPositions[2]!,
      0,
      projected,
    ).toArray(expected, 0);
    projectCosmicGroupToLocalDepthShell(
      duplicateRegistry.renderPositions[3]!,
      duplicateRegistry.renderPositions[4]!,
      duplicateRegistry.renderPositions[5]!,
      1,
      projected,
    ).toArray(expected, 3);

    expect(Array.from(positions.array)).toEqual(Array.from(expected));
    backdrop.dispose();
  });
});

function registry(count = 8, duplicateObjectIds = false): CosmicGroupCatalogRegistry {
  const positions = new Float32Array(count * 3);
  const distances = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const distance = 12 + index * 4;
    const angle = index * 1.7;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * distance;
    positions[offset + 1] = Math.sin(angle * 0.7) * distance * 0.45;
    positions[offset + 2] = Math.sin(angle) * distance;
    distances[index] = distance;
  }
  const catalog: CosmicGroupCatalog = {
    count,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: count > 0 ? 12 : 0,
    maximumDistanceMpc: count > 0 ? 12 + (count - 1) * 4 : 0,
    positionsMpc: positions,
    distancesMpc: distances,
    distanceModulusErrors: new Float32Array(count).fill(0.2),
    velocitiesCmbKmPerSecond: new Int32Array(count).fill(1_200),
    pgcIds: Uint32Array.from({ length: count }, (_, index) =>
      duplicateObjectIds ? 100 : 100 + index,
    ),
    distanceModuli: new Float32Array(count).fill(31),
    filamentPairs: new Uint32Array(),
  };

  return new CosmicGroupCatalogRegistry(catalog, new CoordinateSystem());
}

function minimumAttributeValue(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < attribute.count; index += 1) {
    minimum = Math.min(minimum, attribute.getX(index));
  }

  return minimum;
}

function maximumAttributeValue(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number {
  let maximum = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < attribute.count; index += 1) {
    maximum = Math.max(maximum, attribute.getX(index));
  }

  return maximum;
}
