import * as THREE from 'three';
import {
  calculateGalacticFrameScale,
  calculateMilkyWayReferenceFrameScale,
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
  calculateGalacticDetailTransitionPresence,
  calculateGalacticImmersionDetailOpacity,
  calculateStellarNeighborhoodSceneScale,
  GalacticTransitionLayer,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
} from './galactic-transition-layer';

describe('GalacticTransitionLayer', () => {
  it('installe un fond stellaire procédural et une galaxie de points centrée', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const extragalacticDeepField = getExtragalacticDeepField(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    expect(backdrop.userData).toMatchObject({
      scientificConfidence: 'procedural',
      visualRole: 'decorative',
      visualStyle: 'integrated-galactic-sky-depth',
      distribution: 'isotropic-plus-galactic-plane',
      observerAnchoring: 'camera-centered-distant-shell',
      interiorContinuity: 'continuous-galactic-depth-through-gaia-catalogue-overlay',
      colorTreatment: 'empirical-gaia-dr3-bp-rp-g12-distribution',
      colorAssociation: 'statistical-observed-distribution-not-source-matched',
      colorPopulationSource: '133526-retained-gaia-dr3-g12-samples',
      luminanceTreatment: 'lifted-point-cores-without-a-diffuse-background-veil',
      screenCoverageTreatment: 'fine-observer-centered-grain-preserving-galactic-directionality',
    });
    expect(backdrop.geometry.getAttribute('position').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('color').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointSize').count).toBe(14_000);
    expect(backdrop.geometry.getAttribute('pointAlpha').count).toBe(14_000);
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(backdrop.material.fragmentShader).toContain('stellarHalo');
    expect(backdrop.material.vertexShader).toContain('float prominence');
    expect(backdrop.material.vertexShader).toContain('5.2,');
    expect(backdrop.material.vertexShader).toContain('pow(prominence, 0.82)');
    expect(backdrop.material.vertexShader).toContain('illustrativeRasterSize * pixelRatio');
    expect(backdrop.material.fragmentShader).toContain('float prominenceGain');
    expect(backdrop.material.fragmentShader).toContain('starAlpha * opacity * prominenceGain');
    expect(backdrop.material.fragmentShader).toContain(
      'smoothstep(\n          0.04,\n          0.34,',
    );
    const backdropColors = backdrop.geometry.getAttribute('color').array;

    expect(countGaiaTemperatureFamily(backdropColors, 'cool')).toBeGreaterThan(150);
    expect(countGaiaTemperatureFamily(backdropColors, 'warm')).toBeGreaterThan(5_000);
    expect(countGaiaTemperatureFamily(backdropColors, 'warm')).toBeGreaterThan(
      countGaiaTemperatureFamily(backdropColors, 'cool') * 3,
    );
    expect(spaceRoot.getObjectByName('chromatic-stellar-accents')).toBeUndefined();
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
    expect(extragalacticDeepField).toBeInstanceOf(THREE.Mesh);
    expect(extragalacticDeepField.visible).toBe(false);
    expect(extragalacticDeepField.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      catalogAssociation: 'none',
      sceneRole: 'galaxy-scale-unresolved-deep-field-background',
      scaleScope: 'external-galaxy-views-only',
      representationTechnique: 'single-procedural-spherical-shader-draw',
      observerAnchoring: 'camera-centered-celestial-sphere',
      motionModel: 'fixed-sky-directions-without-translational-parallax',
      rasterAtlas: 'none',
    });
    expect(extragalacticDeepField.material.fragmentShader).toContain('float layeredStructure');
    expect(extragalacticDeepField.material.fragmentShader).toContain('float unresolvedGalaxyLayer');
    expect(extragalacticDeepField.material.fragmentShader).toContain('float darkRift');
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
    expect(milkyWay.frustumCulled).toBe(true);
    expect(milkyWay.geometry.boundingSphere).not.toBeNull();
    expect(milkyWay.material.uniforms['opacity']!.value).toBe(0);
    expect(Object.keys(milkyWay.geometry.attributes).sort()).toEqual([
      'color',
      'pointAlpha',
      'pointSize',
      'position',
    ]);
    expect(milkyWay.geometry.getAttribute('position').count).toBe(336_000);
    expect(milkyWay.geometry.getAttribute('pointSize').count).toBe(336_000);
    expect(milkyWay.geometry.getAttribute('pointAlpha').count).toBe(336_000);
    const galacticColors = milkyWay.geometry.getAttribute('color').array;

    expect(countGaiaTemperatureFamily(galacticColors, 'cool')).toBeGreaterThan(30_000);
    expect(countGaiaTemperatureFamily(galacticColors, 'warm')).toBeGreaterThan(30_000);
    expect(Array.from(galacticColors).every((value) => value >= 0 && value <= 1)).toBe(true);
    const sizes = Array.from(milkyWay.geometry.getAttribute('pointSize').array);

    expect(Math.min(...sizes.slice(0, 10_000))).toBeGreaterThanOrEqual(1.5);
    expect(Math.max(...sizes.slice(0, 10_000))).toBeLessThanOrEqual(35.5);
    expect(sizes.filter((size) => size < 10).length).toBeGreaterThan(230_000);
    expect(sizes.filter((size) => size > 30).length).toBeGreaterThan(8_000);
    expect(sizes.filter((size) => size > 30).length).toBeLessThan(20_000);
    expect(milkyWay.material.vertexShader).toContain('projectionMatrix[1][1]');
    expect(milkyWay.material.vertexShader).toContain('worldScale * focalPixels');
    expect(milkyWay.material.vertexShader).toContain('max(-viewPosition.z, 0.001)');
    expect(milkyWay.material.vertexShader).toContain('projectedDiameter / rasterDiameter');
    expect(milkyWay.material.vertexShader).toContain('float rasterDiameter = 4.0 * pixelRatio');
    expect(milkyWay.material.vertexShader).toContain('length(viewPosition.xyz)');
    expect(milkyWay.material.vertexShader).toContain('smoothstep(8.0, 80.0, distanceToGrain)');
    expect(milkyWay.material.vertexShader).not.toContain('resolvedExposure');
    expect(milkyWay.material.fragmentShader).toContain('float grain = exp(-radiusSquared * 10.0)');
    expect(milkyWay.material.fragmentShader).not.toContain('float halo');
    expect(milkyWay.material.fragmentShader).toContain('vec4(starColor, alpha)');
    for (const removedUniform of [
      'flythroughContext',
      'travelMotion',
      'stellarOriginLocalPosition',
    ]) {
      expect(milkyWay.material.uniforms[removedUniform]).toBeUndefined();
      expect(milkyWay.material.vertexShader).not.toContain(removedUniform);
    }
    expect(milkyWay.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      visualStructure: 'continuous-illustrative-galactocentric-four-arm-volume',
      structureOrigin: 'galactic-center',
      spiralArmCount: 4,
      spiralPitchDegrees: 13,
      adaptedVisualPitchDegrees: 22,
      representationTechnique: 'single-batched-point-cloud',
      surfaceGeometry: 'none',
      densityTreatment: 'one-nested-population-sampling-the-arms-bar-and-thick-disc',
      armStructure: 'irregular-branched-filaments-with-low-density-interarm-gaps',
      flythroughTreatment: 'the-visible-galactic-arms-themselves-no-corridor-or-solar-shell',
      motionCue: 'perspective-expansion-and-parallax-of-fixed-stars',
      luminanceTreatment: 'world-size-perspective-with-subpixel-flux-conservation',
      interiorClarityTreatment: 'fine-density-grain-without-halos-or-near-camera-brightening',
      grainInterpretation: 'illustrative-galactic-density-not-measured-interstellar-dust',
      grainRasterSupportPixels: 4,
      grainOpacityNormalization: 1.45,
      nearPassageTreatment: 'isotropic-camera-distance-fade-without-moving-or-replacing-points',
      localSpurParticleFraction: 0.08,
      apparentScaleTreatment: 'shared-canonical-galactic-metric-for-disc-and-solar-position',
      bulgeParticleFraction: 0.18,
      bulgeColorTreatment:
        'illustrative-old-stellar-population-ivory-center-and-golden-bar-not-black-hole-emission',
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

  it('distingue un bulbe dense et doré des bras plus froids sans grossir ses grains', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);
    const positions = milkyWay.geometry.getAttribute('position');
    const colors = milkyWay.geometry.getAttribute('color');
    const alphas = milkyWay.geometry.getAttribute('pointAlpha');

    for (const quality of ['low', 'medium', 'high'] as const) {
      layer.setQuality(quality);
      const bulge = { count: 0, red: 0, blue: 0, alpha: 0 };
      const arms = { count: 0, red: 0, blue: 0, alpha: 0 };

      for (let index = 0; index < milkyWay.geometry.drawRange.count; index += 1) {
        const radius = Math.hypot(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index),
        );
        const population = radius < 800 ? bulge : radius > 2_500 && radius < 5_000 ? arms : null;

        if (population) {
          population.count += 1;
          population.red += colors.getX(index) * alphas.getX(index);
          population.blue += colors.getZ(index) * alphas.getX(index);
          population.alpha += alphas.getX(index);
        }
      }
      expect(bulge.count / milkyWay.geometry.drawRange.count).toBeGreaterThan(0.1);
      expect(bulge.red / bulge.blue).toBeGreaterThan(1.8);
      expect(bulge.red / bulge.blue).toBeGreaterThan((arms.red / arms.blue) * 1.3);
      expect(bulge.alpha / bulge.count).toBeGreaterThan(0.23);
      expect(bulge.alpha / bulge.count).toBeGreaterThan((arms.alpha / arms.count) * 1.4);
    }
    expect(milkyWay.userData['grainRasterSupportPixels']).toBe(4);
    expect(milkyWay.material.fragmentShader).not.toContain('float halo');
    layer.dispose();
  });

  it('garde le fond autour de la caméra après un recentrage d’origine flottante', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const extragalacticDeepField = getExtragalacticDeepField(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);
    const observerPosition = new THREE.Vector3(18, -7, 4);

    spaceRoot.position.set(-12_400, 860, 2_150);
    layer.setStellarOrigin({ x: 736.02, y: 0, z: 0 });
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
    const extragalacticDeepFieldWorldPosition = extragalacticDeepField.getWorldPosition(
      new THREE.Vector3(),
    );

    expect(backdropWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(backdropWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(backdropWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(extragalacticWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(extragalacticWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(extragalacticWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(extragalacticDeepFieldWorldPosition.x).toBeCloseTo(observerPosition.x, 8);
    expect(extragalacticDeepFieldWorldPosition.y).toBeCloseTo(observerPosition.y, 8);
    expect(extragalacticDeepFieldWorldPosition.z).toBeCloseTo(observerPosition.z, 8);
    expect(milkyWay.position.toArray()).toEqual([0, 0, 0]);
    expect(milkyWay.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(
      spaceRoot.position.toArray(),
    );
    expect(backdrop.visible).toBe(false);
    expect(extragalacticBackground.visible).toBe(false);

    layer.dispose();
  });

  it('adapte les densités et le ratio de pixels à la qualité', () => {
    const { layer, spaceRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const extragalacticDeepField = getExtragalacticDeepField(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
    const milkyWay = getMilkyWay(spaceRoot);

    layer.setQuality('low');
    expect(backdrop.geometry.drawRange.count).toBe(3_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(10_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1.18);
    expect(extragalacticDeepField.material.uniforms['detailStrength']!.value).toBe(0.55);
    expect(extragalacticDeepField.material.uniforms['chromaStrength']!.value).toBe(0.82);
    expect(stellarHalo.geometry.drawRange.count).toBe(12_000);
    expect(milkyWay.geometry.drawRange.count).toBe(144_000);
    expect(milkyWay.material.uniforms['qualityDensityCompensation']!.value).toBe(1);
    expect(milkyWay.userData['qualityDensityCompensation']).toBe(1);

    layer.setQuality('medium');
    expect(backdrop.geometry.drawRange.count).toBe(7_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(24_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1.08);
    expect(extragalacticDeepField.material.uniforms['detailStrength']!.value).toBe(0.78);
    expect(extragalacticDeepField.material.uniforms['chromaStrength']!.value).toBe(0.92);
    expect(stellarHalo.geometry.drawRange.count).toBe(26_000);
    expect(milkyWay.geometry.drawRange.count).toBe(168_000);
    expect(milkyWay.material.uniforms['qualityDensityCompensation']!.value).toBe(1.35);

    layer.setQuality('high');
    expect(backdrop.geometry.drawRange.count).toBe(14_000);
    expect(extragalacticBackground.geometry.drawRange.count).toBe(52_000);
    expect(extragalacticBackground.material.uniforms['qualityScale']!.value).toBe(1);
    expect(extragalacticDeepField.material.uniforms['detailStrength']!.value).toBe(1);
    expect(extragalacticDeepField.material.uniforms['chromaStrength']!.value).toBe(1);
    expect(stellarHalo.geometry.drawRange.count).toBe(48_000);
    expect(milkyWay.geometry.drawRange.count).toBe(336_000);
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

  it('projette les diamètres avec la hauteur réelle du viewport rendu', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);
    const renderer = {
      getCurrentViewport: (target: THREE.Vector4) => target.set(0, 0, 2_880, 1_800),
    } as THREE.WebGLRenderer;

    milkyWay.onBeforeRender(
      renderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      milkyWay.geometry,
      milkyWay.material,
      new THREE.Group(),
    );
    expect(milkyWay.material.uniforms['viewportHeight']!.value).toBe(1_800);
    layer.dispose();
  });

  it('ne change ni les étoiles ni leur luminosité intrinsèque pendant la traversée', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);
    const geometry = milkyWay.geometry;
    const positions = geometry.getAttribute('position');
    const initialPositions = positions.array.slice();
    const alphas = geometry.getAttribute('pointAlpha').array.slice();
    const sizes = geometry.getAttribute('pointSize').array.slice();

    for (const distance of [14_000, 9_000, 5_000, 3_600, 2_200, 1_400, 520]) {
      layer.setStellarOrigin({ x: distance / 10, y: 0, z: 0 });
      layer.update({
        lodLevel: distance > 2_200 ? 3 : 2,
        deltaSeconds: 10,
        cameraDistance: distance,
        starRadiance: 1,
        galaxyRadiance: 1,
        observerPosition: { x: distance, y: 1_600, z: 2_000 },
      });
      expect(milkyWay.geometry).toBe(geometry);
      expect(geometry.getAttribute('position')).toBe(positions);
      // Compare native buffers without expanding millions of values into matcher diagnostics.
      expect(positions.array.every((value, index) => value === initialPositions[index])).toBe(true);
      expect(
        geometry.getAttribute('pointAlpha').array.every((value, index) => value === alphas[index]),
      ).toBe(true);
      expect(
        geometry.getAttribute('pointSize').array.every((value, index) => value === sizes[index]),
      ).toBe(true);
      expect(milkyWay.position.toArray()).toEqual([0, 0, 0]);
      expect(milkyWay.material.uniforms['opacity']!.value).toBeCloseTo(0.96, 8);
    }
    layer.dispose();
  });

  it('garde le même nuage de points quand Gaia/HYG ajoute son détail', () => {
    expect(calculateGalacticDetailTransitionPresence(5, 120_000)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(4, 17_000)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(3, 2_200)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(2, 2_200)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(2, 1_800)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(2, 1_400)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(2, 900)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(2, 520)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(3, 1_400)).toBeCloseTo(
      calculateGalacticDetailTransitionPresence(2, 1_400),
      8,
    );
    expect(calculateGalacticDetailTransitionPresence(1, 600)).toBeCloseTo(
      calculateGalacticDetailTransitionPresence(2, 600),
      8,
    );
    expect(calculateGalacticDetailTransitionPresence(1, 600)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(0, 600)).toBe(1);
    expect(calculateGalacticDetailTransitionPresence(6, 120_000)).toBe(0);
    expect(calculateGalacticDetailTransitionPresence(2, Number.NaN)).toBe(0);
    expect(calculateGalacticDetailTransitionPresence(3, Number.NaN)).toBe(0);
    expect(calculateGalacticDetailTransitionPresence(3, -1)).toBe(0);
  });

  it('remplit le disque épais sur 360 degrés, à chaque qualité, sans tunnel de caméra', () => {
    const { layer, spaceRoot } = createLayer();
    const milkyWay = getMilkyWay(spaceRoot);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    for (const quality of ['low', 'medium', 'high'] as const) {
      layer.setQuality(quality);
      for (let octant = 0; octant < 8; octant += 1) {
        const azimuth = (octant * Math.PI) / 4;

        for (const height of [-1_500, 1_500]) {
          const observer = new THREE.Vector3(
            Math.cos(azimuth) * 3_200,
            height,
            Math.sin(azimuth) * 3_200,
          ).multiplyScalar(milkyWay.scale.x);

          expect(countNearbyParticles(milkyWay, observer, 800 * milkyWay.scale.x)).toBeGreaterThan(
            10,
          );
        }
      }
    }
    layer.dispose();
  });

  it('conserve le volume procédural indépendamment de l’atlas et le masque hors échelle', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const extragalacticDeepField = getExtragalacticDeepField(spaceRoot);
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
    expect(extragalacticDeepField.visible).toBe(false);
    expect(stellarHalo.visible).toBe(true);
    expect(stellarHalo.material.uniforms['opacity']!.value).toBeCloseTo(0.46, 6);
    expect(stellarHalo.scale.x).toBeCloseTo(milkyWay.scale.x, 8);
    expect(stellarNeighborhoodRoot.scale.x).toBeCloseTo(0.085, 6);
    expect(stellarNeighborhoodRoot.scale.y).toBeGreaterThan(0.035);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(0.05);
    expect(stellarNeighborhoodRoot.scale.y).toBeLessThan(stellarNeighborhoodRoot.scale.x);
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeCloseTo(0.24, 6);

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
    expect(extragalacticDeepField.visible).toBe(false);

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
    expect(extragalacticDeepField.visible).toBe(true);
    expect(extragalacticDeepField.material.uniforms['opacity']!.value).toBeGreaterThan(0.01);
    expect(extragalacticDeepField.material.uniforms['opacity']!.value).toBeLessThan(0.03);

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 3_600,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.uniforms['opacity']!.value).toBeCloseTo(fallbackOpacity, 6);
    expect(milkyWay.scale.x).toBeCloseTo(2_759.413 / 11_400, 5);
    expect(milkyWay.userData).toMatchObject({
      worldDiameter: expect.closeTo(2_759.413, 3),
      physicalWorldDiameter: expect.closeTo(2_759.413, 3),
      visualScaleFactor: 1,
      visualSceneUnitsPerKiloparsec: 90,
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
    expect(milkyWay.scale.x).toBeCloseTo(
      calculateMilkyWayReferenceFrameScale(13_300).worldDiameter / 11_400,
      5,
    );

    layer.update({
      lodLevel: 0,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.opacity).toBeCloseTo(0.24, 6);
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
    expect(extragalacticDeepField.visible).toBe(false);
    expect(milkyWay.visible).toBe(false);

    layer.dispose();
  });

  it('superpose les couches galactiques au catalogue local sans rupture de LOD', () => {
    const { layer, spaceRoot, stellarNeighborhoodRoot } = createLayer();
    const backdrop = getBackdrop(spaceRoot);
    const extragalacticBackground = getExtragalacticBackground(spaceRoot);
    const stellarHalo = getStellarHalo(spaceRoot);
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
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.uniforms['opacity']!.value).toBeCloseTo(0.24, 6);
    expect(stellarHalo.visible).toBe(true);
    expect(extragalacticBackground.visible).toBe(false);
    const lodTwoMilkyWayOpacity = milkyWay.material.uniforms['opacity']!.value as number;
    const lodTwoBackdropOpacity = backdrop.material.uniforms['opacity']!.value as number;
    const lodTwoStellarHaloOpacity = stellarHalo.material.uniforms['opacity']!.value as number;

    layer.update({
      lodLevel: 3,
      deltaSeconds: 10,
      cameraDistance: 1_400,
      starRadiance: 1,
      galaxyRadiance: 1,
    });
    expect(milkyWay.visible).toBe(true);
    expect(milkyWay.material.uniforms['opacity']!.value).toBeCloseTo(lodTwoMilkyWayOpacity, 8);
    expect(backdrop.visible).toBe(true);
    expect(backdrop.material.uniforms['opacity']!.value).toBeCloseTo(lodTwoBackdropOpacity, 8);
    expect(stellarHalo.material.uniforms['opacity']!.value).toBeCloseTo(
      lodTwoStellarHaloOpacity,
      8,
    );

    // The close-view catalogue has its own readable scale; its origin must still agree with the
    // physical disc. Do not enlarge the galaxy to contain logarithmically expanded stellar detail.
    expect(stellarNeighborhoodRoot.position.length() / (milkyWay.scale.x * 5_700)).toBeCloseTo(
      0.533461,
      6,
    );
    const localScale = calculateStellarNeighborhoodSceneScale(420, 736.02);

    expect(localScale.radialScale).toBeCloseTo(1, 6);
    expect(localScale.verticalScale).toBeCloseTo(1, 6);

    layer.dispose();
  });

  it('conserve le même grain galactique de la silhouette externe au voisinage stellaire', () => {
    expect(calculateGalacticImmersionDetailOpacity(300_000)).toBe(0);
    expect(calculateGalacticImmersionDetailOpacity(235_000)).toBeCloseTo(0.48, 8);
    expect(calculateGalacticImmersionDetailOpacity(170_000)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(120_000)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(40_000)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(1_800)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(220)).toBeCloseTo(0.96, 8);
    expect(calculateGalacticImmersionDetailOpacity(150)).toBeGreaterThan(0);
    expect(calculateGalacticImmersionDetailOpacity(150)).toBeLessThan(0.96);
    expect(calculateGalacticImmersionDetailOpacity(70)).toBe(0);
    expect(calculateGalacticImmersionDetailOpacity(0)).toBe(0);
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
    const extragalacticDeepField = getExtragalacticDeepField(spaceRoot);
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
    let extragalacticDeepFieldGeometryDisposeCount = 0;
    let extragalacticDeepFieldMaterialDisposeCount = 0;
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
    extragalacticDeepField.geometry.addEventListener('dispose', () => {
      extragalacticDeepFieldGeometryDisposeCount += 1;
    });
    extragalacticDeepField.material.addEventListener('dispose', () => {
      extragalacticDeepFieldMaterialDisposeCount += 1;
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
    expect(spaceRoot.getObjectByName('chromatic-stellar-accents')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-extragalactic-background')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-extragalactic-deep-field-sky')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-milky-way-stellar-halo')).toBeUndefined();
    expect(spaceRoot.getObjectByName('illustrative-milky-way')).toBeUndefined();
    expect(backdropGeometryDisposeCount).toBe(1);
    expect(backdropMaterialDisposeCount).toBe(1);
    expect(extragalacticGeometryDisposeCount).toBe(1);
    expect(extragalacticMaterialDisposeCount).toBe(1);
    expect(extragalacticDeepFieldGeometryDisposeCount).toBe(1);
    expect(extragalacticDeepFieldMaterialDisposeCount).toBe(1);
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

function getExtragalacticDeepField(
  spaceRoot: THREE.Group,
): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  return spaceRoot.getObjectByName('illustrative-extragalactic-deep-field-sky') as THREE.Mesh<
    THREE.SphereGeometry,
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

function countNearbyParticles(
  milkyWay: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  cameraPosition: THREE.Vector3,
  radius: number,
): number {
  const positions = milkyWay.geometry.getAttribute('position');
  const localCamera = cameraPosition.clone().divideScalar(milkyWay.scale.x);
  const localRadiusSquared = (radius / milkyWay.scale.x) ** 2;
  let count = 0;

  for (let index = 0; index < milkyWay.geometry.drawRange.count; index += 1) {
    const dx = positions.getX(index) - localCamera.x;
    const dy = positions.getY(index) - localCamera.y;
    const dz = positions.getZ(index) - localCamera.z;

    if (dx * dx + dy * dy + dz * dz <= localRadiusSquared) {
      count += 1;
    }
  }

  return count;
}

function countGaiaTemperatureFamily(colors: ArrayLike<number>, family: 'cool' | 'warm'): number {
  let count = 0;

  for (let offset = 0; offset < colors.length; offset += 3) {
    const red = colors[offset]!;
    const blue = colors[offset + 2]!;
    const matches = family === 'cool' ? blue > red * 1.05 : red > blue * 1.2;

    if (matches) {
      count += 1;
    }
  }

  return count;
}
