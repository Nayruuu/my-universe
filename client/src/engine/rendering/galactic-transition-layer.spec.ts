import * as THREE from 'three';
import { PerformanceManager } from '../performance/performance-manager';
import { GalacticTransitionLayer } from './galactic-transition-layer';

describe('GalacticTransitionLayer', () => {
  it('installe un fond stellaire procédural et un disque galactique centré', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    expect(backdrop.userData).toMatchObject({
      scientificConfidence: 'procedural',
      visualRole: 'decorative',
      visualStyle: 'integrated-galactic-sky-depth',
      distribution: 'isotropic-plus-galactic-plane',
    });
    expect(backdrop.geometry.getAttribute('position').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('color').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointSize').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointAlpha').count).toBe(14_000);
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(backdrop.material.fragmentShader).toContain('stellarHalo');
    expect(milkyWay.position.length()).toBe(0);
    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.opacity).toBe(0);
    expect(milkyWay.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualStructure: 'illustrative-galactocentric-four-arm-disk',
      structureOrigin: 'galactic-center',
      spiralArmCount: 4,
      spiralPitchDegrees: 13,
      visualRole: 'galactic-scale-transition',
    });
    expect(stellarNeighborhoodRoot.scale.toArray()).toEqual([1, 1, 1]);

    layer.dispose();
  });

  it('adapte les densités et le ratio de pixels à la qualité', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setQuality('low');
    expect(backdrop.geometry.drawRange.count).toBe(3_000);
    expect(milkyWay.geometry.drawRange.count).toBe(2_000);

    layer.setQuality('medium');
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(milkyWay.geometry.drawRange.count).toBe(5_000);

    layer.setQuality('high');
    expect(backdrop.geometry.drawRange.count).toBe(14_000);
    expect(milkyWay.geometry.drawRange.count).toBe(10_000);

    layer.setPixelRatio(3);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(1.5);
    layer.setPixelRatio(0.25);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(0.5);

    layer.dispose();
  });

  it('fait disparaître progressivement le fallback dès que l’atlas est prêt', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 0,
      cameraDistance: 9_600,
      starRadiance: 1,
      galaxyRadiance: 1,
      legacyMilkyWayVisible: true,
    });
    expect(milkyWay.material.opacity).toBe(0);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 9_600,
      starRadiance: 1,
      galaxyRadiance: 1,
      legacyMilkyWayVisible: true,
    });
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.opacity).toBeGreaterThan(0.015);
    expect(stellarNeighborhoodRoot.scale.x).toBeGreaterThanOrEqual(0.14);
    expect(stellarNeighborhoodRoot.scale.x).toBeLessThanOrEqual(0.2);
    expect(backdrop.visible).toBe(false);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 9_600,
      starRadiance: 1,
      galaxyRadiance: 1,
      legacyMilkyWayVisible: false,
    });
    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.opacity).toBeLessThan(0.004);

    layer.update({
      lodLevel: 0,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
      legacyMilkyWayVisible: true,
    });
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeGreaterThan(0.22);
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(1, 4);

    layer.update({
      lodLevel: 99,
      deltaSeconds: 10,
      cameraDistance: 17_000,
      starRadiance: 1,
      galaxyRadiance: 1,
      legacyMilkyWayVisible: true,
    });
    expect(backdrop.visible).toBe(false);
    expect(milkyWay.visible).toBe(false);

    layer.dispose();
  });

  it('retire et détruit toutes ses ressources GPU', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);
    const backdropGeometryDispose = vi.spyOn(backdrop.geometry, 'dispose');
    const backdropMaterialDispose = vi.spyOn(backdrop.material, 'dispose');
    const milkyWayGeometryDispose = vi.spyOn(milkyWay.geometry, 'dispose');
    const milkyWayMaterialDispose = vi.spyOn(milkyWay.material, 'dispose');

    layer.dispose();

    expect(spaceRoot.getObjectByName('distant-star-field')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-milky-way')).toBeUndefined();
    expect(backdropGeometryDispose).toHaveBeenCalledOnce();
    expect(backdropMaterialDispose).toHaveBeenCalledOnce();
    expect(milkyWayGeometryDispose).toHaveBeenCalledOnce();
    expect(milkyWayMaterialDispose).toHaveBeenCalledOnce();
  });
});

function createLayer(): {
  layer: GalacticTransitionLayer;
  spaceRoot: THREE.Group;
  stellarNeighborhoodRoot: THREE.Group;
} {
  const spaceRoot = new THREE.Group();
  const stellarNeighborhoodRoot = new THREE.Group();

  spaceRoot.add(stellarNeighborhoodRoot);

  return {
    layer: new GalacticTransitionLayer(
      spaceRoot,
      stellarNeighborhoodRoot,
      new PerformanceManager(),
    ),
    spaceRoot,
    stellarNeighborhoodRoot,
  };
}

function getBackdrop(
  spaceRoot: THREE.Group,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  return spaceRoot.getObjectByName('distant-star-field') as THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
}

function getMilkyWay(
  spaceRoot: THREE.Group,
): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  return spaceRoot.getObjectByName('illustrative-milky-way') as THREE.Points<
    THREE.BufferGeometry,
    THREE.PointsMaterial
  >;
}
