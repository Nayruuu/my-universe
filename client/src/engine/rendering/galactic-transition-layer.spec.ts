import * as THREE from 'three';
import {
  calculateGalacticFrameScale,
  calculateMilkyWayReferenceFrameScale,
  calculateMilkyWaySceneScale,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
  MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS,
} from '../coordinates/galaxy-scale-model';
import {
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
} from '../coordinates/stellar-neighborhood-scale-model';
import { PerformanceManager } from '../performance/performance-manager';
import {
  calculateGalacticImmersionDetailOpacity,
  calculateStellarNeighborhoodSceneScale,
  GalacticTransitionLayer,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
} from './galactic-transition-layer';

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
      observerAnchoring: 'camera-centered-distant-shell',
      interiorContinuity: 'restrained-unresolved-star-floor-through-galactic-to-stellar-handoff',
      colorTreatment: 'illustrative-spectral-variety-with-sapphire-ivory-amber-and-red-stars',
      luminanceTreatment: 'lifted-point-cores-without-a-diffuse-background-veil',
    });
    expect(backdrop.geometry.getAttribute('position').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('color').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointSize').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointAlpha').count).toBe(14_000);
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(backdrop.material.fragmentShader).toContain('stellarHalo');
    const backdropColors = backdrop.geometry.getAttribute('color').array;

    expect(countChromaticPoints(backdropColors, 'blue')).toBeGreaterThan(500);
    expect(countChromaticPoints(backdropColors, 'warm')).toBeGreaterThan(500);
    expect(milkyWay.position.length()).toBe(0);
    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.uniforms['opacity']!.value).toBe(0);
    expect(milkyWay.geometry.getAttribute('pointSize').count).toBe(280_000);
    expect(milkyWay.geometry.getAttribute('pointAlpha').count).toBe(280_000);
    expect(milkyWay.geometry.getAttribute('pointSoftness').count).toBe(280_000);
    const flythrough = milkyWay.geometry.getAttribute('pointFlythrough');

    expect(flythrough.count).toBe(280_000);
    expect(Array.from(flythrough.array).filter((value) => value === 1)).toHaveLength(28_000);
    expect(Array.from(flythrough.array).filter((value) => value === 2)).toHaveLength(56_000);
    expect(Array.from(flythrough.array).filter((value) => value === 3)).toHaveLength(56_000);
    expect(Array.from(flythrough.array).filter((value) => value > 0)).toHaveLength(140_000);
    expect(
      Array.from(flythrough.array).every(
        (value) => value === 0 || value === 1 || value === 2 || value === 3,
      ),
    ).toBe(true);
    const galacticColors = milkyWay.geometry.getAttribute('color').array;

    expect(countChromaticPoints(galacticColors, 'blue')).toBeGreaterThan(5_000);
    expect(countChromaticPoints(galacticColors, 'warm')).toBeGreaterThan(5_000);
    expect(
      Array.from({ length: galacticColors.length / 3 }, (_, index) => index * 3).some(
        (offset) =>
          galacticColors[offset]! > galacticColors[offset + 1]! &&
          galacticColors[offset + 2]! > galacticColors[offset + 1]!,
      ),
    ).toBe(true);
    expect(milkyWay.material.vertexShader).toContain('immersionGrowth');
    expect(milkyWay.material.vertexShader).toContain('flythroughEmphasis');
    expect(milkyWay.material.vertexShader).toContain('corridorFlythroughProximity');
    expect(milkyWay.material.vertexShader).toContain('nearPassageProximity');
    expect(milkyWay.material.vertexShader).toContain('stellarExposure');
    expect(milkyWay.material.vertexShader).toContain('travelMotion');
    expect(milkyWay.material.vertexShader).toContain('interiorMorphologyVisibility');
    expect(milkyWay.material.vertexShader).toContain('mix(0.7, 0.12, softMorphologyMask)');
    expect(milkyWay.material.vertexShader).toContain('broadVisibility');
    expect(milkyWay.material.vertexShader).toContain('pow(broadFlythroughProximity, 2.0)');
    expect(milkyWay.material.vertexShader).toContain('44.0 * pixelRatio');
    expect(milkyWay.material.fragmentShader).toContain('shortTrail');
    expect(milkyWay.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualStructure: 'continuous-illustrative-galactocentric-four-arm-volume',
      structureOrigin: 'galactic-center',
      spiralArmCount: 4,
      spiralPitchDegrees: 13,
      adaptedVisualPitchDegrees: 22,
      visualRole: 'galactic-scale-stellar-detail',
      visualStyle: 'batched-three-dimensional-stellar-detail',
      representationTechnique: 'single-batched-point-cloud',
      rasterTextureRole: 'none-at-galactic-detail-scale',
      verticalEnvelope: 'thin-and-thick-disc-detail',
      densityTreatment: 'branched-stellar-disc-with-interior-unresolved-star-floor',
      flythroughTreatment:
        'static-multi-depth-thick-disc-entry-shell-and-near-passage-tracers-for-motion-parallax',
      flythroughParticleFraction: 5 / 10,
      flythroughCorridorParticleFraction: 4 / 10,
      flythroughNearPassageParticleFraction: 2 / 10,
      flythroughCorridorTreatment:
        'static-rotational-entry-height-shell-with-stratified-near-passage-core',
      flythroughNearPassageTreatment:
        'quality-nested-cylindrical-stratification-along-the-calibrated-entry-height-profile',
      motionCue: 'multi-depth-parallax-with-motion-gated-short-near-star-trails',
      interiorClarityTreatment:
        'soft-morphology-suppression-with-reinforced-crisp-proximity-and-background-stars',
      interiorStellarOpacityFloor: 0.42,
      colorStructure: 'warm-ivory-integrated-light-sapphire-young-stars-amber-core-and-magenta-hii',
      luminanceTreatment: 'preserved-dark-field-with-kind-weighted-stellar-core-luminance',
      localSpurTreatment: 'illustrative-branch-anchored-at-the-solar-galactocentric-radius',
      localSpurParticleFraction: 0.14,
      apparentScaleTreatment: 'illustrative-immersive-envelope-over-canonical-reference-frame',
      physicalDiameterLightYears: 100_000,
      authoringDiameter: 11_400,
    });
    milkyWay.geometry.computeBoundingBox();
    expect(
      milkyWay.geometry.boundingBox!.max.y - milkyWay.geometry.boundingBox!.min.y,
    ).toBeGreaterThan(900);
    expect(stellarNeighborhoodRoot.scale.toArray()).toEqual([1, 1, 1]);
    expect(stellarNeighborhoodRoot.userData).toMatchObject({
      scaleTransition: 'readable-to-physical-galactic-disc-containment',
      verticalScaleTransition: 'illustrative-galactic-plane-containment',
      originTransition: 'continuous-galactic-metric',
      sourceMaximumDistanceKiloparsecs: 5,
      containmentMargin: 0.92,
      galacticOverviewScale: 0.085,
      expansionDistanceRange: [420, 3_600],
      revealDistanceRange: [STELLAR_NEIGHBORHOOD_REVEAL_START, STELLAR_NEIGHBORHOOD_REVEAL_END],
    });
    expect(stellarNeighborhoodRoot.userData['authoringBoundingRadius']).toBeGreaterThan(2_800);

    layer.dispose();
  });

  it('garde le fond autour de la caméra après un recentrage d’origine flottante', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const observerPosition = new THREE.Vector3(18, -7, 4);

    spaceRoot.position.set(-12_400, 860, 2_150);
    layer.update({
      lodLevel: 0,
      deltaSeconds: 10,
      cameraDistance: 0.06,
      starRadiance: 1,
      galaxyRadiance: 1,
      observerPosition,
    });
    const backdropWorldPosition = backdrop.getWorldPosition(new THREE.Vector3());

    expect(backdropWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(backdropWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(backdropWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(backdrop.visible).toBe(true);

    layer.dispose();
  });

  it('adapte les densités et le ratio de pixels à la qualité', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setQuality('low');
    expect(backdrop.geometry.drawRange.count).toBe(3_000);
    expect(milkyWay.geometry.drawRange.count).toBe(60_000);

    layer.setQuality('medium');
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(milkyWay.geometry.drawRange.count).toBe(140_000);

    layer.setQuality('high');
    expect(backdrop.geometry.drawRange.count).toBe(14_000);
    expect(milkyWay.geometry.drawRange.count).toBe(280_000);

    layer.setPixelRatio(3);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(milkyWay.material.uniforms['pixelRatio']!.value).toBe(1.5);
    layer.setPixelRatio(0.25);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(0.5);
    expect(milkyWay.material.uniforms['pixelRatio']!.value).toBe(0.5);

    layer.dispose();
  });

  it('maintient des étoiles fixes assez proches du corridor de plongée pour produire du parallaxe', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setQuality('high');
    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });

    // Representative poses from the deterministic default Galactic choreography. These tracers
    // are fixed in the galaxy; crossing their neighbourhood therefore creates genuine parallax.
    for (const cameraPosition of [
      new THREE.Vector3(3_123, 893, 1_579),
      new THREE.Vector3(1_889, 682, 754),
    ]) {
      expect(countNearbyFlythroughParticles(milkyWay, cameraPosition, 400)).toBeGreaterThan(40);
      expect(countNearbyFlythroughParticles(milkyWay, cameraPosition, 160, 2)).toBeGreaterThan(2);
      expect(countNearbyFlythroughParticles(milkyWay, cameraPosition, 160, 3)).toBeGreaterThan(8);
    }

    layer.update({
      lodLevel: 3,
      deltaSeconds: 1,
      cameraDistance: 3_000,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.material.uniforms['travelMotion']!.value).toBeGreaterThan(0.95);
    layer.update({
      lodLevel: 3,
      deltaSeconds: 1,
      cameraDistance: 3_000,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.material.uniforms['travelMotion']!.value).toBeLessThan(0.001);

    layer.dispose();
  });

  it('conserve le volume procédural indépendamment de l’atlas et le masque hors échelle', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setStellarOrigin({ x: 736.02, y: 0, z: 0 });
    expect(stellarNeighborhoodRoot.position.x).toBe(736.02);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 0,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.material.uniforms['opacity']!.value).toBe(0);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.visible).toBe(true);
    const fallbackOpacity = milkyWay.material.uniforms['opacity']!.value as number;

    expect(fallbackOpacity).toBeCloseTo(0.96, 6);
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(0.085, 6);
    expect(stellarNeighborhoodRoot.scale.y).toBeGreaterThan(0.035);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(0.05);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    expect(backdrop.visible).toBe(false);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_000,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    const approachScale = calculateStellarNeighborhoodSceneScale(3_000, 736.02);

    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(approachScale.radialScale, 4);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(approachScale.verticalScale, 4);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.uniforms['opacity']!.value).toBeGreaterThan(0);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 6_500,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    const outgoingScale = calculateStellarNeighborhoodSceneScale(6_500, 736.02);

    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(outgoingScale.radialScale, 4);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(outgoingScale.verticalScale, 4);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.uniforms['opacity']!.value).toBeCloseTo(fallbackOpacity, 6);
    expect(milkyWay.scale.x).toBeCloseTo(11_037.65 / 11_400, 5);
    expect(milkyWay.userData).toMatchObject({
      worldDiameter: expect.closeTo(11_037.65, 3),
      physicalWorldDiameter: expect.closeTo(2_759.413, 3),
      visualScaleFactor: 4,
      visualSceneUnitsPerKiloparsec: 360,
      referenceFrameSceneUnitsPerKiloparsec: 90,
      referenceFrameBlend: 'galactic',
    });
    expect(stellarNeighborhoodRoot.position.x).toBeCloseTo(736.02, 4);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 13_300,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(stellarNeighborhoodRoot.position.x).toBeGreaterThan(0);
    expect(stellarNeighborhoodRoot.position.x).toBeLessThan(736.02);
    expect(stellarNeighborhoodRoot.position.x).toBeCloseTo(
      736.02 * calculateGalacticFrameScale(13_300),
      4,
    );
    expect(stellarNeighborhoodRoot.scale.x).toBeGreaterThan(0.02);
    expect(stellarNeighborhoodRoot.scale.x).toBeLessThan(0.13);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    expect(milkyWay.scale.x).toBeGreaterThan(306.601 / 11_400);
    expect(milkyWay.scale.x).toBeLessThan(11_037.65 / 11_400);

    layer.update({
      lodLevel: 0,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeGreaterThan(0.22);
    expect(stellarNeighborhoodRoot.scale.x).toBeGreaterThan(0.2);
    expect(stellarNeighborhoodRoot.scale.x).toBeLessThan(0.8);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: Number.POSITIVE_INFINITY,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    const exteriorScale = calculateStellarNeighborhoodSceneScale(Number.POSITIVE_INFINITY, 736.02);

    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(exteriorScale.radialScale, 8);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(exteriorScale.verticalScale, 8);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    expect(stellarNeighborhoodRoot.position.x).toBeCloseTo(736.02 * (4 / 90), 4);

    layer.update({
      lodLevel: 0,
      deltaSeconds: 10,
      cameraDistance: Number.NaN,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(1, 4);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(1, 4);
    expect(stellarNeighborhoodRoot.position.x).toBeCloseTo(736.02, 4);

    layer.update({
      lodLevel: 99,
      deltaSeconds: 10,
      cameraDistance: 17_000,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(backdrop.visible).toBe(false);
    expect(milkyWay.visible).toBe(false);

    layer.dispose();
  });

  it('déploie le voisinage stellaire pendant que la structure galactique reste visible', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setStellarOrigin({ x: 736.02, y: 0, z: 0 });
    layer.update({
      lodLevel: 2,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
    });

    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.uniforms['opacity']!.value).toBeCloseTo(0.96, 6);
    expect(stellarNeighborhoodRoot.position.x).toBeCloseTo(736.02, 6);
    expect(stellarNeighborhoodRoot.scale.x).toBeGreaterThan(0.2);
    expect(stellarNeighborhoodRoot.scale.x).toBeLessThan(0.8);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    const stellarBackdropOpacity = backdrop.material.uniforms['opacity']!.value as number;

    expect(backdrop.visible).toBe(true);
    expect(stellarBackdropOpacity).toBeGreaterThan(0.13);
    expect(stellarBackdropOpacity).toBeLessThan(0.15);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(backdrop.material.uniforms['opacity']!.value).toBeCloseTo(stellarBackdropOpacity, 5);

    const galacticOverviewDiameter =
      STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS * stellarNeighborhoodRoot.scale.x * 2;

    expect(
      galacticOverviewDiameter / calculateMilkyWaySceneScale(1_400).worldDiameter,
    ).toBeLessThan(1);
    const localScale = calculateStellarNeighborhoodSceneScale(420, 736.02);

    expect(localScale.radialScale).toBeCloseTo(1, 6);
    expect(localScale.verticalScale).toBeCloseTo(1, 6);

    layer.dispose();
  });

  it('conserve le même grain galactique de la silhouette externe au voisinage stellaire', () => {
    expect(calculateGalacticImmersionDetailOpacity(40_000)).toBe(0);
    expect(calculateGalacticImmersionDetailOpacity(25_000)).toBeCloseTo(0.48, 8);
    expect(calculateGalacticImmersionDetailOpacity(10_000)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(1_800)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(260)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(150)).toBeGreaterThan(0.4);
    expect(calculateGalacticImmersionDetailOpacity(150)).toBeLessThan(0.96);
    expect(calculateGalacticImmersionDetailOpacity(70)).toBeCloseTo(0.4032, 8);
    expect(calculateGalacticImmersionDetailOpacity(0)).toBeCloseTo(0.4032, 8);
    expect(calculateGalacticImmersionDetailOpacity(Number.NaN)).toBe(0);
  });

  it('fait tenir le volume Gaia de 5 kpc autour du Soleil dans le disque du Groupe local', () => {
    const originDistance = 736.02;
    const scale = calculateStellarNeighborhoodSceneScale(17_000, originDistance);
    const invalidOriginFallback = calculateStellarNeighborhoodSceneScale(17_000, Number.NaN);
    const referenceFrame = calculateMilkyWayReferenceFrameScale(17_000);
    const radialOuterEdge =
      originDistance * scale.originScale +
      STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS * scale.radialScale;
    const verticalOuterEdge = STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS * scale.verticalScale;
    const galaxyHalfThickness =
      (referenceFrame.worldDiameter * MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS) /
      MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER /
      2;

    expect(scale.originScale).toBeGreaterThan(0.7);
    expect(scale.originScale).toBeLessThan(0.8);
    expect(scale.physicalRadialScale * STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS).toBeCloseTo(
      referenceFrame.sceneUnitsPerKiloparsec * 5,
      8,
    );
    expect(radialOuterEdge).toBeLessThan(referenceFrame.worldDiameter / 2);
    expect(verticalOuterEdge).toBeLessThan(galaxyHalfThickness);
    expect(scale.radialScale).toBeGreaterThan(scale.verticalScale);
    expect(invalidOriginFallback.maximumContainedRadialScale).toBeGreaterThan(
      scale.maximumContainedRadialScale,
    );
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
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  return spaceRoot.getObjectByName('illustrative-milky-way') as THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
}

function countNearbyFlythroughParticles(
  milkyWay: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  cameraPosition: THREE.Vector3,
  radius: number,
  particleKind?: number,
): number {
  const positions = milkyWay.geometry.getAttribute('position');
  const flythrough = milkyWay.geometry.getAttribute('pointFlythrough');
  const inverseScale = 1 / milkyWay.scale.x;
  const cameraX = cameraPosition.x * inverseScale;
  const cameraY = cameraPosition.y * inverseScale;
  const cameraZ = cameraPosition.z * inverseScale;
  const localRadiusSquared = (radius * inverseScale) ** 2;
  let count = 0;

  for (let index = 0; index < positions.count; index += 1) {
    const kind = flythrough.getX(index);

    if (particleKind === undefined ? kind <= 0 : kind !== particleKind) {
      continue;
    }
    const deltaX = positions.getX(index) - cameraX;
    const deltaY = positions.getY(index) - cameraY;
    const deltaZ = positions.getZ(index) - cameraZ;

    if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= localRadiusSquared) {
      count += 1;
    }
  }

  return count;
}

function countChromaticPoints(colors: ArrayLike<number>, family: 'blue' | 'warm'): number {
  let count = 0;

  for (let offset = 0; offset < colors.length; offset += 3) {
    const red = colors[offset]!;
    const blue = colors[offset + 2]!;

    if (family === 'blue' ? blue > red * 1.2 : red > blue * 1.2) {
      count += 1;
    }
  }

  return count;
}
