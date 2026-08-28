import * as THREE from 'three';
import {
  calculateGalacticFrameScale,
  calculateMilkyWayReferenceFrameScale,
  calculateMilkyWaySceneScale,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
  MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS,
} from '../coordinates/galaxy-scale-model';
import {
  STELLAR_NEIGHBORHOOD_EXPANSION_START,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
} from '../coordinates/stellar-neighborhood-scale-model';
import { PerformanceManager } from '../performance/performance-manager';
import {
  calculateGalacticFlythroughContext,
  calculateGalacticImmersionDetailOpacity,
  calculateStellarNeighborhoodSceneScale,
  GalacticTransitionLayer,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
} from './galactic-transition-layer';

describe('GalacticTransitionLayer', () => {
  it('installe un fond stellaire procédural et un disque galactique centré', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    expect(backdrop.userData).toMatchObject({
      scientificConfidence: 'procedural',
      visualRole: 'decorative',
      visualStyle: 'integrated-galactic-sky-depth',
      distribution: 'isotropic-plus-galactic-plane',
      observerAnchoring: 'camera-centered-distant-shell',
      interiorContinuity: 'restrained-unresolved-star-floor-through-galactic-to-stellar-handoff',
      colorTreatment:
        'illustrative-temperature-sequence-with-sapphire-cyan-ivory-amber-and-red-stars',
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
    expect(countChromaticPoints(backdropColors, 'cyan')).toBeGreaterThan(500);
    expect(countChromaticPoints(backdropColors, 'warm')).toBeGreaterThan(500);
    expect(extragalacticBackground).toBeInstanceOf(THREE.Points);
    expect(extragalacticBackground.visible).toBe(false);
    expect(extragalacticBackground.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      sceneRole: 'non-interactive-distant-galaxy-background',
      observerAnchoring: 'camera-centered-celestial-shell',
      motionModel: 'fixed-sky-directions-without-translational-parallax',
    });
    expect(extragalacticBackground.geometry.getAttribute('position').count).toBe(52_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(24_000);
    expect(extragalacticBackground.material.fragmentShader).toContain('float spiralArms');
    expect(stellarHalo).toBeInstanceOf(THREE.Points);
    expect(stellarHalo.visible).toBe(false);
    expect(stellarHalo.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualRole: 'sparse-galactic-surroundings',
      motionModel: 'fixed-galactocentric-points-with-perspective-only-parallax',
      diffuseEmission: 'none',
      fogContribution: 'none',
    });
    expect(milkyWay.position.length()).toBe(0);
    expect(milkyWay.visible).toBe(false);
    expect(milkyWay.material.uniforms['opacity']!.value).toBe(0);
    expect(milkyWay.material.uniforms['flythroughContext']!.value).toBe(0);
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
    expect(countChromaticPoints(galacticColors, 'cyan')).toBeGreaterThan(5_000);
    expect(countChromaticPoints(galacticColors, 'warm')).toBeGreaterThan(5_000);
    expect(countChromaticPoints(galacticColors, 'magenta')).toBeGreaterThan(250);
    expect(averageColorSaturation(galacticColors)).toBeGreaterThan(0.48);
    expect(milkyWay.material.vertexShader).toContain('immersionGrowth');
    expect(milkyWay.material.vertexShader).toContain('flythroughEmphasis');
    expect(milkyWay.material.vertexShader).toContain('corridorFlythroughProximity');
    expect(milkyWay.material.vertexShader).toContain('nearPassageProximity');
    expect(milkyWay.material.vertexShader).toContain('stellarExposure');
    expect(milkyWay.material.vertexShader).toContain('stellarLuminance');
    expect(milkyWay.material.vertexShader).toContain('mix(vec3(stellarLuminance), color, 1.18)');
    expect(milkyWay.material.vertexShader).toContain('travelMotion');
    expect(milkyWay.material.vertexShader).toContain('interiorMorphologyVisibility');
    expect(milkyWay.material.vertexShader).toContain('mix(0.7, 0.12, softMorphologyMask)');
    expect(milkyWay.material.vertexShader).toContain('broadVisibility');
    expect(milkyWay.material.vertexShader).toContain('pow(broadFlythroughProximity, 1.7)');
    expect(milkyWay.material.vertexShader).toContain('smoothstep(120.0, 900.0, distanceToCamera)');
    expect(milkyWay.material.vertexShader).toContain('float minimumPointSize');
    expect(milkyWay.material.vertexShader).toContain('uniform float flythroughContext');
    expect(milkyWay.material.vertexShader).not.toContain(
      'smoothstep(360.0, 900.0, cameraDistance)',
    );
    expect(milkyWay.material.vertexShader).toContain('1.25,');
    expect(milkyWay.material.vertexShader).toContain('30.0 * pixelRatio');
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
      entryContinuityTreatment:
        'log-distance-graded-spatial-proximity-field-without-inner-distance-pop',
      interiorClarityTreatment:
        'soft-morphology-suppression-with-reinforced-crisp-proximity-and-background-stars',
      interiorStellarOpacityFloor: 0.42,
      colorStructure: 'temperature-structured-sapphire-cyan-ivory-amber-red-stars-and-magenta-hii',
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
      motionContinuity: 'hidden-reference-frame-expansion-before-stable-catalog-reveal',
      verticalScaleTransition: 'illustrative-galactic-plane-containment',
      originTransition: 'continuous-galactic-metric',
      sourceMaximumDistanceKiloparsecs: 5,
      containmentMargin: 0.92,
      galacticOverviewScale: 0.085,
      expansionDistanceRange: [STELLAR_NEIGHBORHOOD_EXPANSION_START, 3_600],
      revealDistanceRange: [STELLAR_NEIGHBORHOOD_REVEAL_START, STELLAR_NEIGHBORHOOD_REVEAL_END],
    });
    expect(stellarNeighborhoodRoot.userData['authoringBoundingRadius']).toBeGreaterThan(2_800);

    layer.dispose();
  });

  it('garde le fond autour de la caméra après un recentrage d’origine flottante', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
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
    const extragalacticWorldPosition = extragalacticBackground.getWorldPosition(
      new THREE.Vector3(),
    );

    expect(backdropWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(backdropWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(backdropWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(extragalacticWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(extragalacticWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(extragalacticWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(backdrop.visible).toBe(true);
    expect(extragalacticBackground.visible).toBe(false);

    layer.dispose();
  });

  it('adapte les densités et le ratio de pixels à la qualité', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setQuality('low');
    expect(backdrop.geometry.drawRange.count).toBe(3_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(10_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1.18);
    expect(stellarHalo.geometry.drawRange.count).toBe(12_000);
    expect(milkyWay.geometry.drawRange.count).toBe(60_000);
    expect(milkyWay.material.uniforms['qualityDensityCompensation']!.value).toBe(2);
    expect(milkyWay.userData['qualityDensityCompensation']).toBe(2);

    layer.setQuality('medium');
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(24_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1.08);
    expect(stellarHalo.geometry.drawRange.count).toBe(26_000);
    expect(milkyWay.geometry.drawRange.count).toBe(140_000);
    expect(milkyWay.material.uniforms['qualityDensityCompensation']!.value).toBe(1.35);

    layer.setQuality('high');
    expect(backdrop.geometry.drawRange.count).toBe(14_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(52_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1);
    expect(stellarHalo.geometry.drawRange.count).toBe(48_000);
    expect(milkyWay.geometry.drawRange.count).toBe(280_000);
    expect(milkyWay.material.uniforms['qualityDensityCompensation']!.value).toBe(1);

    layer.setPixelRatio(3);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(extragalacticBackground.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(stellarHalo.material.uniforms['pixelRatio']!.value).toBe(1.5);
    expect(milkyWay.material.uniforms['pixelRatio']!.value).toBe(1.5);
    layer.setPixelRatio(0.25);
    expect(backdrop.material.uniforms['pixelRatio']!.value).toBe(0.5);
    expect(extragalacticBackground.material.uniforms['pixelRatio']!.value).toBe(0.5);
    expect(stellarHalo.material.uniforms['pixelRatio']!.value).toBe(0.5);
    expect(milkyWay.material.uniforms['pixelRatio']!.value).toBe(0.5);

    layer.dispose();
  });

  it('garde le champ de traversée stable aux changements de référentiel internes', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);
    const sampledDistances = Array.from(
      { length: 28 },
      (_, index) => 198 * Math.pow(3_600 / 198, index / 27),
    );
    const sampledContexts = sampledDistances.map(calculateGalacticFlythroughContext);
    const maximumContextStep = Math.max(
      ...sampledContexts.slice(1).map((context, index) => context - sampledContexts[index]!),
    );

    expect(calculateGalacticFlythroughContext(4.8)).toBe(0);
    expect(calculateGalacticFlythroughContext(0)).toBe(0);
    expect(calculateGalacticFlythroughContext(70)).toBe(0);
    expect(calculateGalacticFlythroughContext(198)).toBeCloseTo(0.217_997, 5);
    expect(calculateGalacticFlythroughContext(520)).toBeCloseTo(0.621_373, 5);
    expect(calculateGalacticFlythroughContext(900)).toBeCloseTo(0.833_218, 5);
    expect(calculateGalacticFlythroughContext(1_400)).toBeCloseTo(0.952_947, 5);
    expect(maximumContextStep).toBeLessThan(0.08);
    for (const distance of [2_200, 3_600]) {
      expect(calculateGalacticFlythroughContext(distance)).toBe(1);
      layer.update({
        lodLevel: 2,
        deltaSeconds: 1,
        cameraDistance: distance,
        starRadiance: 1,
        galaxyRadiance: 1,
      });
      expect(milkyWay.material.uniforms['flythroughContext']!.value).toBe(1);
    }
    expect(calculateGalacticFlythroughContext(4_900)).toBeCloseTo(0.5, 8);
    expect(calculateGalacticFlythroughContext(6_200)).toBe(0);
    expect(calculateGalacticFlythroughContext(Number.NaN)).toBe(0);
    expect(calculateGalacticFlythroughContext(Number.POSITIVE_INFINITY)).toBe(0);

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
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
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
    expect(extragalacticBackground.visible).toBe(true);
    expect(extragalacticBackground.material.uniforms['opacity']!.value).toBeCloseTo(0.62, 6);
    expect(stellarHalo.visible).toBe(true);
    expect(stellarHalo.material.uniforms['opacity']!.value).toBeCloseTo(0.46, 6);
    expect(stellarHalo.scale.x).toBeCloseTo(milkyWay.scale.x, 8);
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
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(1, 8);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(1, 8);

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
    expect(extragalacticBackground.visible).toBe(false);
    expect(milkyWay.visible).toBe(false);

    layer.dispose();
  });

  it('déploie le voisinage stellaire avant de révéler ses étoiles locales', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
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
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(1, 8);
    expect(stellarNeighborhoodRoot.scale.y).toBeCloseTo(1, 8);
    const stellarBackdropOpacity = backdrop.material.uniforms['opacity']!.value as number;

    expect(backdrop.visible).toBe(true);
    expect(stellarBackdropOpacity).toBeGreaterThan(0.13);
    expect(stellarBackdropOpacity).toBeLessThan(0.15);
    expect(extragalacticBackground.visible).toBe(false);

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
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);
    const backdropGeometry = backdrop.geometry;
    const backdropPositions = backdrop.geometry.getAttribute('position');
    const milkyWayGeometry = milkyWay.geometry;
    const milkyWayPositions = milkyWay.geometry.getAttribute('position');
    let backdropGeometryDisposeCount = 0;
    let backdropMaterialDisposeCount = 0;
    let extragalacticGeometryDisposeCount = 0;
    let extragalacticMaterialDisposeCount = 0;
    let milkyWayGeometryDisposeCount = 0;
    let milkyWayMaterialDisposeCount = 0;
    let stellarHaloGeometryDisposeCount = 0;
    let stellarHaloMaterialDisposeCount = 0;

    backdrop.geometry.addEventListener('dispose', () => {
      backdropGeometryDisposeCount += 1;
    });
    backdrop.material.addEventListener('dispose', () => {
      backdropMaterialDisposeCount += 1;
    });
    extragalacticBackground.geometry.addEventListener('dispose', () => {
      extragalacticGeometryDisposeCount += 1;
    });
    extragalacticBackground.material.addEventListener('dispose', () => {
      extragalacticMaterialDisposeCount += 1;
    });
    milkyWay.geometry.addEventListener('dispose', () => {
      milkyWayGeometryDisposeCount += 1;
    });
    milkyWay.material.addEventListener('dispose', () => {
      milkyWayMaterialDisposeCount += 1;
    });
    stellarHalo.geometry.addEventListener('dispose', () => {
      stellarHaloGeometryDisposeCount += 1;
    });
    stellarHalo.material.addEventListener('dispose', () => {
      stellarHaloMaterialDisposeCount += 1;
    });

    layer.dispose();

    expect(spaceRoot.getObjectByName('distant-star-field')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-extragalactic-background')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-milky-way-stellar-halo')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-milky-way')).toBeUndefined();
    expect(backdropGeometryDisposeCount).toBe(1);
    expect(backdropMaterialDisposeCount).toBe(1);
    expect(extragalacticGeometryDisposeCount).toBe(1);
    expect(extragalacticMaterialDisposeCount).toBe(1);
    expect(milkyWayGeometryDisposeCount).toBe(1);
    expect(milkyWayMaterialDisposeCount).toBe(1);
    expect(stellarHaloGeometryDisposeCount).toBe(1);
    expect(stellarHaloMaterialDisposeCount).toBe(1);

    const secondLayer = createLayer();
    const secondBackdrop = getBackdrop(secondLayer.spaceRoot);
    const secondMilkyWay = getMilkyWay(secondLayer.spaceRoot);

    expect(secondBackdrop.geometry).not.toBe(backdropGeometry);
    expect(secondBackdrop.geometry.getAttribute('position')).not.toBe(backdropPositions);
    expect(secondBackdrop.geometry.getAttribute('position').array).toBe(backdropPositions.array);
    expect(secondMilkyWay.geometry).not.toBe(milkyWayGeometry);
    expect(secondMilkyWay.geometry.getAttribute('position')).not.toBe(milkyWayPositions);
    expect(secondMilkyWay.geometry.getAttribute('position').array).toBe(milkyWayPositions.array);

    secondLayer.layer.dispose();
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

function getExtragalacticBackground(
  spaceRoot: THREE.Group,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  return spaceRoot.getObjectByName('illustrative-extragalactic-background') as THREE.Points<
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

function getStellarHalo(
  spaceRoot: THREE.Group,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  return spaceRoot.getObjectByName('illustrative-milky-way-stellar-halo') as THREE.Points<
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

function countChromaticPoints(
  colors: ArrayLike<number>,
  family: 'blue' | 'cyan' | 'magenta' | 'warm',
): number {
  let count = 0;

  for (let offset = 0; offset < colors.length; offset += 3) {
    const red = colors[offset]!;
    const green = colors[offset + 1]!;
    const blue = colors[offset + 2]!;
    const matches =
      family === 'blue'
        ? blue > green * 1.28 && blue > red * 1.6
        : family === 'cyan'
          ? green > red * 1.8 && blue > red * 1.8 && blue < green * 2.2
          : family === 'magenta'
            ? red > green * 2 && blue > green * 1.5
            : red > blue * 1.5 && green > blue * 1.08;

    if (matches) {
      count += 1;
    }
  }

  return count;
}

function averageColorSaturation(colors: ArrayLike<number>): number {
  let saturationSum = 0;

  for (let offset = 0; offset < colors.length; offset += 3) {
    const red = colors[offset]!;
    const green = colors[offset + 1]!;
    const blue = colors[offset + 2]!;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);

    saturationSum += maximum > 0 ? (maximum - minimum) / maximum : 0;
  }

  return saturationSum / (colors.length / 3);
}
