import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import {
  calculateMilkyWaySceneScale,
  MILKY_WAY_DIAMETER_LIGHT_YEARS,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
} from '../coordinates/galaxy-scale-model';
import {
  calculateStellarNeighborhoodSceneScale,
  GALACTIC_STELLAR_NEIGHBORHOOD_SCALE,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
  STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN,
  STELLAR_NEIGHBORHOOD_EXPANSION_END,
  STELLAR_NEIGHBORHOOD_EXPANSION_START,
  STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
} from '../coordinates/stellar-neighborhood-scale-model';
import { stellarColorIndexToRgb } from '../materials/star-color';
import {
  QUALITY_PARTICLE_COUNTS,
  type PerformanceManager,
} from '../performance/performance-manager';
import {
  calculateAdaptedMilkyWayLocalSpurAngle,
  calculateIllustrativeMilkyWayArmAngle,
  MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES,
  MILKY_WAY_ADAPTED_VISUAL_RADIUS,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS,
} from './milky-way-density-model';
import {
  calculateExtragalacticBackgroundOpacity,
  ExtragalacticBackground,
} from './extragalactic-background';
import {
  calculateExtragalacticDeepFieldOpacity,
  ExtragalacticDeepFieldSky,
} from './extragalactic-deep-field-sky';
import { calculateMilkyWayStellarHaloOpacity, MilkyWayStellarHalo } from './milky-way-stellar-halo';
import { MilkyWayDustField } from './milky-way-dust-field';

export interface GalacticTransitionFrame {
  lodLevel: number;
  deltaSeconds: number;
  cameraDistance: number;
  starRadiance: number;
  galaxyRadiance: number;
  observerPosition?: Vector3Like;
}

export {
  calculateStellarNeighborhoodReveal,
  calculateStellarNeighborhoodSceneScale,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
  STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN,
  STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS,
  type StellarNeighborhoodSceneScale,
} from '../coordinates/stellar-neighborhood-scale-model';

export class GalacticTransitionLayer {
  private readonly backdropGeometry = createBackdropGeometry();
  private readonly backdropMaterial = createBackdropMaterial();
  private readonly milkyWayGeometry = createMilkyWayGeometry();
  private readonly milkyWayMaterial = createMilkyWayMaterial();
  private readonly dustField = new MilkyWayDustField(
    this.milkyWayGeometry.getAttribute('position'),
  );
  private readonly backdrop = new THREE.Points(this.backdropGeometry, this.backdropMaterial);
  private readonly milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
  private readonly extragalacticBackground = new ExtragalacticBackground();
  private readonly extragalacticDeepField = new ExtragalacticDeepFieldSky();
  private readonly stellarHalo = new MilkyWayStellarHalo();
  private readonly observerWorldPosition = new THREE.Vector3();
  private quality: GraphicQuality = 'medium';
  private milkyWayDrawCount = 0;
  private readonly renderViewport = new THREE.Vector4();
  private readonly stellarNeighborhoodOrigin = new THREE.Vector3();
  private stellarNeighborhoodRadialScale = 1;
  private stellarNeighborhoodVerticalScale = 1;
  private stellarNeighborhoodOriginScale = 1;

  constructor(
    private readonly spaceRoot: THREE.Group,
    private readonly stellarNeighborhoodRoot: THREE.Group,
    private readonly performanceManager: PerformanceManager,
  ) {
    this.stellarNeighborhoodRoot.userData['scaleTransition'] =
      'readable-to-physical-galactic-disc-containment';
    this.stellarNeighborhoodRoot.userData['motionContinuity'] =
      'hidden-reference-frame-expansion-before-stable-catalog-reveal';
    this.stellarNeighborhoodRoot.userData['verticalScaleTransition'] =
      'illustrative-galactic-plane-containment';
    this.stellarNeighborhoodRoot.userData['originTransition'] = 'continuous-galactic-metric';
    this.stellarNeighborhoodRoot.userData['sourceMaximumDistanceKiloparsecs'] =
      STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS;
    this.stellarNeighborhoodRoot.userData['authoringBoundingRadius'] =
      STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS;
    this.stellarNeighborhoodRoot.userData['containmentMargin'] =
      STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN;
    this.stellarNeighborhoodRoot.userData['galacticOverviewScale'] =
      GALACTIC_STELLAR_NEIGHBORHOOD_SCALE;
    this.stellarNeighborhoodRoot.userData['expansionDistanceRange'] = [
      STELLAR_NEIGHBORHOOD_EXPANSION_START,
      STELLAR_NEIGHBORHOOD_EXPANSION_END,
    ];
    this.stellarNeighborhoodRoot.userData['revealDistanceRange'] = [
      STELLAR_NEIGHBORHOOD_REVEAL_START,
      STELLAR_NEIGHBORHOOD_REVEAL_END,
    ];
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS.medium);
    this.backdrop.name = 'distant-star-field';
    this.backdrop.userData['scientificConfidence'] = 'procedural';
    this.backdrop.userData['visualRole'] = 'decorative';
    this.backdrop.userData['visualStyle'] = 'integrated-galactic-sky-depth';
    this.backdrop.userData['distribution'] = 'isotropic-plus-galactic-plane';
    this.backdrop.userData['observerAnchoring'] = 'camera-centered-distant-shell';
    this.backdrop.userData['interiorContinuity'] =
      'continuous-galactic-depth-through-gaia-catalogue-overlay';
    this.backdrop.userData['colorTreatment'] = 'empirical-gaia-dr3-bp-rp-g12-distribution';
    this.backdrop.userData['colorAssociation'] =
      'statistical-observed-distribution-not-source-matched';
    this.backdrop.userData['colorPopulationSource'] = '133526-retained-gaia-dr3-g12-samples';
    this.backdrop.userData['luminanceTreatment'] =
      'lifted-point-cores-without-a-diffuse-background-veil';
    this.backdrop.userData['screenCoverageTreatment'] =
      'fine-observer-centered-grain-preserving-galactic-directionality';

    this.milkyWay.name = 'illustrative-milky-way';
    this.milkyWay.visible = false;
    this.milkyWay.renderOrder = 3;
    // Positions are genuinely static, including the stars encountered inside the arms. The same
    // perspective projection is used outside and inside; no camera-centred replacement population.
    this.milkyWay.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(this.renderViewport);
      this.milkyWayMaterial.uniforms['viewportHeight']!.value = this.renderViewport.w;
    };
    this.milkyWay.userData['scientificConfidence'] = 'illustrative';
    this.milkyWay.userData['visualStructure'] =
      'continuous-illustrative-galactocentric-four-arm-volume';
    this.milkyWay.userData['structureOrigin'] = 'galactic-center';
    this.milkyWay.userData['spiralArmCount'] = MILKY_WAY_ARM_COUNT;
    this.milkyWay.userData['spiralPitchDegrees'] = MILKY_WAY_ARM_PITCH_DEGREES;
    this.milkyWay.userData['adaptedVisualPitchDegrees'] = MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES;
    this.milkyWay.userData['visualRole'] = 'primary-milky-way-representation';
    this.milkyWay.userData['visualStyle'] =
      'batched-three-dimensional-point-galaxy-and-stellar-detail';
    this.milkyWay.userData['representationTechnique'] = 'single-batched-point-cloud';
    this.milkyWay.userData['rasterTextureRole'] = 'none-at-all-galactic-scales';
    this.milkyWay.userData['surfaceGeometry'] = 'none';
    this.milkyWay.userData['verticalEnvelope'] = 'thin-and-thick-disc-detail';
    this.milkyWay.userData['densityTreatment'] =
      'one-nested-population-sampling-the-arms-bar-and-thick-disc';
    this.milkyWay.userData['armStructure'] =
      'irregular-branched-filaments-with-low-density-interarm-gaps';
    this.milkyWay.userData['flythroughTreatment'] =
      'the-visible-galactic-arms-themselves-no-corridor-or-solar-shell';
    this.milkyWay.userData['motionCue'] = 'perspective-expansion-and-parallax-of-fixed-stars';
    this.milkyWay.userData['entryContinuityTreatment'] =
      'same-galactocentric-points-form-the-exterior-galaxy-and-resolve-into-traversal-stars';
    this.milkyWay.userData['morphologyResolutionTreatment'] =
      'same-points-resolve-only-from-their-physical-distance-to-the-camera';
    this.milkyWay.userData['interiorClarityTreatment'] =
      'fine-density-grain-without-halos-or-near-camera-brightening';
    this.milkyWay.userData['grainInterpretation'] =
      'illustrative-galactic-density-not-measured-interstellar-dust';
    this.milkyWay.userData['grainRasterSupportPixels'] = MILKY_WAY_GRAIN_RASTER_SIZE;
    this.milkyWay.userData['grainOpacityNormalization'] = MILKY_WAY_GRAIN_OPACITY_NORMALIZATION;
    this.milkyWay.userData['nearPassageTreatment'] =
      'isotropic-camera-distance-fade-without-moving-or-replacing-points';
    this.milkyWay.userData['colorStructure'] =
      'illustrative-blue-white-ivory-amber-stars-with-sparse-pink-hii-knots';
    this.milkyWay.userData['bulgeColorTreatment'] =
      'illustrative-old-stellar-population-ivory-center-and-golden-bar-not-black-hole-emission';
    this.milkyWay.userData['bulgeParticleFraction'] = MILKY_WAY_BULGE_PARTICLE_FRACTION;
    this.milkyWay.userData['luminanceTreatment'] =
      'world-size-perspective-with-subpixel-flux-conservation';
    this.milkyWay.userData['localSpurTreatment'] =
      'illustrative-orion-spur-in-the-adapted-galactic-morphology';
    this.milkyWay.userData['localSpurParticleFraction'] = MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION;
    this.milkyWay.userData['apparentScaleTreatment'] =
      'shared-canonical-galactic-metric-for-disc-and-solar-position';
    this.milkyWay.userData['physicalDiameterLightYears'] = MILKY_WAY_DIAMETER_LIGHT_YEARS;
    this.milkyWay.userData['authoringDiameter'] = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER;

    this.spaceRoot.add(
      this.extragalacticDeepField.mesh,
      this.extragalacticBackground.points,
      this.backdrop,
      this.stellarHalo.points,
      this.milkyWay,
      this.dustField.points,
    );
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.stellarNeighborhoodOrigin.set(position.x, position.y, position.z);
    this.applyStellarNeighborhoodOrigin();
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS[quality]);
    this.extragalacticBackground.setQuality(quality);
    this.extragalacticDeepField.setQuality(quality);
    this.stellarHalo.setQuality(quality);
    this.dustField.setQuality(quality);
    this.applyMilkyWayParticleBudget(0);
  }

  public setPixelRatio(pixelRatio: number): void {
    const clampedPixelRatio = THREE.MathUtils.clamp(pixelRatio, 0.5, 1.5);

    this.backdropMaterial.uniforms['pixelRatio']!.value = clampedPixelRatio;
    this.milkyWayMaterial.uniforms['pixelRatio']!.value = clampedPixelRatio;
    this.extragalacticBackground.setPixelRatio(clampedPixelRatio);
    this.stellarHalo.setPixelRatio(clampedPixelRatio);
    this.dustField.setPixelRatio(clampedPixelRatio);
  }

  public update(frame: GalacticTransitionFrame): void {
    this.synchronizeBackdropWithObserver(frame.observerPosition);
    const milkyWaySceneScale = calculateMilkyWaySceneScale(frame.cameraDistance);

    this.applyMilkyWayParticleBudget(frame.cameraDistance);
    // The point batch is the Milky Way itself from the nearby-Universe view through the Galactic
    // crossing. Gaia/HYG own the settled stellar-neighbourhood view, so the Galactic layers remain
    // present throughout their reveal instead of disappearing at the categorical LOD boundary.
    const galacticContextVisible = frame.lodLevel >= 1 && frame.lodLevel <= 4;
    const detailTransitionPresence = calculateGalacticDetailTransitionPresence(
      frame.lodLevel,
      frame.cameraDistance,
    );
    const targetOpacity =
      calculateGalacticMacroscopicDetailOpacity(frame.cameraDistance) * detailTransitionPresence;
    const targetDustOpacity =
      calculateGalacticDustTraversalOpacity(frame.cameraDistance) * detailTransitionPresence;
    const targetStellarNeighborhoodScale = calculateStellarNeighborhoodSceneScale(
      frame.cameraDistance,
      this.stellarNeighborhoodOrigin.length(),
    );
    const targetBackdropOpacity = calculateBackdropOpacity(frame.lodLevel, frame.cameraDistance);
    const targetStellarHaloOpacity = galacticContextVisible
      ? calculateMilkyWayStellarHaloOpacity(frame.cameraDistance) *
        detailTransitionPresence *
        Math.min(1, Math.max(0, frame.galaxyRadiance))
      : 0;
    const extragalacticVisible = frame.lodLevel >= 2 && frame.lodLevel <= 4;
    const targetExtragalacticOpacity = extragalacticVisible
      ? calculateExtragalacticBackgroundOpacity(frame.cameraDistance)
      : 0;
    const targetExtragalacticDeepFieldOpacity = extragalacticVisible
      ? calculateExtragalacticDeepFieldOpacity(frame.cameraDistance)
      : 0;

    const currentMilkyWayOpacity = this.milkyWayMaterial.uniforms['opacity']!.value as number;
    const milkyWayOpacity = dampOpacity(currentMilkyWayOpacity, targetOpacity, frame.deltaSeconds);
    const currentDustOpacity = this.dustField.points.material.uniforms['opacity']!.value as number;
    const dustOpacity = dampOpacity(currentDustOpacity, targetDustOpacity, frame.deltaSeconds);

    this.milkyWayMaterial.uniforms['opacity']!.value = milkyWayOpacity;
    this.milkyWay.userData['transitionPresence'] = detailTransitionPresence;
    this.milkyWay.visible = milkyWayOpacity > MINIMUM_VISIBLE_OPACITY;
    this.milkyWay.scale.setScalar(milkyWaySceneScale.modelScale);
    // The exterior population yields progressively to its already co-spatial resolved dust cells.
    // This is a resolution hand-off, not a camera motion, a second sky, or a solar-centred shell.
    this.dustField.update(
      dustOpacity,
      milkyWaySceneScale.modelScale,
      frame.observerPosition,
      calculateGalacticDustCoarseDetailPresence(frame.cameraDistance),
      frame.cameraDistance,
    );
    this.milkyWay.userData['modelScale'] = milkyWaySceneScale.modelScale;
    this.milkyWay.userData['worldDiameter'] = milkyWaySceneScale.worldDiameter;
    this.milkyWay.userData['physicalWorldDiameter'] = milkyWaySceneScale.physicalWorldDiameter;
    this.milkyWay.userData['visualScaleFactor'] = milkyWaySceneScale.visualScaleFactor;
    this.milkyWay.userData['visualSceneUnitsPerKiloparsec'] =
      milkyWaySceneScale.visualSceneUnitsPerKiloparsec;
    this.milkyWay.userData['referenceFrameSceneUnitsPerKiloparsec'] =
      milkyWaySceneScale.referenceFrameSceneUnitsPerKiloparsec;
    this.milkyWay.userData['referenceFrameBlend'] = milkyWaySceneScale.referenceFrameBlend;
    this.extragalacticBackground.update(
      targetExtragalacticOpacity,
      frame.deltaSeconds,
      frame.galaxyRadiance,
    );
    this.extragalacticDeepField.update(
      targetExtragalacticDeepFieldOpacity,
      frame.deltaSeconds,
      frame.galaxyRadiance,
    );
    this.stellarHalo.update(targetStellarHaloOpacity, frame.deltaSeconds, milkyWaySceneScale);
    // The stellar-neighborhood transform below remains a canonical reference-frame conversion.
    // Applying another time-domain damping there made this scene layer lag behind the object
    // registry even though both use the same distance curve. Copy that deterministic transform
    // exactly; opacity keeps its temporal damping because it is purely presentational.
    this.stellarNeighborhoodRadialScale = targetStellarNeighborhoodScale.radialScale;
    this.stellarNeighborhoodVerticalScale = targetStellarNeighborhoodScale.verticalScale;
    this.stellarNeighborhoodOriginScale = targetStellarNeighborhoodScale.originScale;
    this.stellarNeighborhoodRoot.scale.set(
      this.stellarNeighborhoodRadialScale,
      this.stellarNeighborhoodVerticalScale,
      this.stellarNeighborhoodRadialScale,
    );
    this.stellarNeighborhoodRoot.userData['radialScale'] = this.stellarNeighborhoodRadialScale;
    this.stellarNeighborhoodRoot.userData['verticalScale'] = this.stellarNeighborhoodVerticalScale;
    this.stellarNeighborhoodRoot.userData['originScale'] = this.stellarNeighborhoodOriginScale;
    this.stellarNeighborhoodRoot.userData['physicalRadialScale'] =
      targetStellarNeighborhoodScale.physicalRadialScale;
    this.stellarNeighborhoodRoot.userData['maximumContainedRadialScale'] =
      targetStellarNeighborhoodScale.maximumContainedRadialScale;
    this.stellarNeighborhoodRoot.userData['maximumContainedVerticalScale'] =
      targetStellarNeighborhoodScale.maximumContainedVerticalScale;
    this.applyStellarNeighborhoodOrigin();
    this.backdropMaterial.opacity = dampOpacity(
      this.backdropMaterial.opacity,
      targetBackdropOpacity,
      frame.deltaSeconds,
    );
    this.backdropMaterial.uniforms['opacity']!.value = this.backdropMaterial.opacity;
    this.backdrop.visible = this.backdropMaterial.opacity > MINIMUM_VISIBLE_OPACITY;
  }

  public dispose(): void {
    this.spaceRoot.remove(this.backdrop, this.milkyWay);
    this.extragalacticBackground.dispose();
    this.extragalacticDeepField.dispose();
    this.stellarHalo.dispose();
    this.dustField.dispose();
    this.backdropGeometry.dispose();
    this.backdropMaterial.dispose();
    this.milkyWayGeometry.dispose();
    this.milkyWayMaterial.dispose();
  }

  private synchronizeBackdropWithObserver(observerPosition?: Vector3Like): void {
    if (!observerPosition) {
      return;
    }
    this.observerWorldPosition.set(observerPosition.x, observerPosition.y, observerPosition.z);
    this.backdrop.position.copy(this.spaceRoot.worldToLocal(this.observerWorldPosition));
    this.extragalacticDeepField.setObserverPosition(this.backdrop.position);
  }

  /**
   * The deterministic point population covers every arm in each prefix. At large distances,
   * retaining every sub-pixel sample only spends vertex work: the same cloud remains in place,
   * with an exposure compensation for its reduced static sample budget.
   */
  private applyMilkyWayParticleBudget(cameraDistance: number): void {
    const fullParticleCount = getMilkyWayParticleCount(
      this.quality,
      this.performanceManager.getParticleCount(this.quality),
    );
    const nextDrawCount = calculateMilkyWayParticleDrawCount(
      this.quality,
      cameraDistance,
      fullParticleCount,
    );

    if (nextDrawCount === this.milkyWayDrawCount) {
      return;
    }

    const densityCompensation = calculateMilkyWayParticleDensityCompensation(
      this.quality,
      nextDrawCount,
      fullParticleCount,
    );

    this.milkyWayGeometry.setDrawRange(0, nextDrawCount);
    this.milkyWayMaterial.uniforms['qualityDensityCompensation']!.value = densityCompensation;
    this.milkyWayDrawCount = nextDrawCount;
    this.milkyWay.userData['qualityDensityCompensation'] = densityCompensation;
    this.milkyWay.userData['activeParticleCount'] = nextDrawCount;
    this.milkyWay.userData['particleBudgetTreatment'] =
      'distance-adaptive-deterministic-prefix-with-static-position-and-exposure-compensation';
  }

  private applyStellarNeighborhoodOrigin(): void {
    this.stellarNeighborhoodRoot.position
      .copy(this.stellarNeighborhoodOrigin)
      .multiplyScalar(this.stellarNeighborhoodOriginScale);
  }
}

const LOCAL_SKY_PARTICLE_COUNTS = {
  low: 3_000,
  medium: 7_000,
  high: 14_000,
} as const satisfies Record<GraphicQuality, number>;
// A prefix of this deterministic sample covers the entire galaxy at every quality level.
const MILKY_WAY_PARTICLE_GROUP_SIZE = {
  low: 24,
  medium: 12,
  // High quality retains a dense deterministic prefix, but leaves enough GPU headroom for the
  // co-spatial dust, halo and nearby-Universe fields during the long fly-through.
  high: 10,
} as const satisfies Record<GraphicQuality, number>;
const MILKY_WAY_PARTICLE_COUNT = 336_000;
const GALACTIC_DETAIL_MEDIUM_SAMPLE_DISTANCE = 36_000;
const GALACTIC_DETAIL_FAR_SAMPLE_DISTANCE = 96_000;
const MILKY_WAY_BULGE_PARTICLE_FRACTION = 0.18;
const MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION = 0.08;
const MILKY_WAY_GRAIN_RASTER_SIZE = 4;
const MILKY_WAY_GRAIN_OPACITY_NORMALIZATION = 1.45;
const BACKDROP_OPACITIES = [0.32, 0.42, 0.24, 0, 0, 0, 0] as const;
const STELLAR_BACKDROP_MINIMUM_RASTER_SIZE = 2.4;
const STELLAR_BACKDROP_PROMINENT_RASTER_SIZE = 5.2;
const STELLAR_BACKDROP_PROMINENCE_EXPONENT = 0.82;
const STELLAR_BACKDROP_PROMINENCE_ALPHA_GAIN = 1.18;
const STELLAR_BACKDROP_CORE_INNER_RADIUS = 0.04;
const STELLAR_BACKDROP_CORE_OUTER_RADIUS = 0.34;
const GALACTIC_DETAIL_NEAR_FADE_START = 70;
// Keep the existing cloud cross-fade independent of the later catalogue/annotation reveal.
const GALACTIC_DETAIL_NEAR_FADE_END = 220;
const GALACTIC_MACRO_DETAIL_HANDOFF_START = 280;
// Start resolving the exterior silhouette well before the Solar neighbourhood. This widens the
// visual crossing while leaving the documented Galactic metric and every camera input untouched.
const GALACTIC_MACRO_DETAIL_HANDOFF_END = 6_000;
const GALACTIC_MACRO_DETAIL_MINIMUM_PRESENCE = 0.28;
const GALACTIC_DUST_COARSE_DETAIL_FADE_START = 1_200;
const GALACTIC_DUST_COARSE_DETAIL_FADE_END = 5_400;
const GALACTIC_DETAIL_OUTER_FADE_START = 170_000;
const GALACTIC_DETAIL_OUTER_FADE_END = 300_000;
const MINIMUM_VISIBLE_OPACITY = 0.004;
const MILKY_WAY_PROCEDURAL_DETAIL_OPACITY = 0.96;
const GALACTIC_DETAIL_QUALITY_DENSITY_COMPENSATION = {
  low: 1,
  medium: 1.35,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;
const STELLAR_BACKDROP_ENTRY_FADE_START = 3_600;
const STELLAR_BACKDROP_ENTRY_FADE_END = 9_000;
const EMPIRICAL_GAIA_BP_RP_QUANTILES = [
  0, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975, 0.99, 1,
] as const;
// Empirical quantiles from the 133,526 retained Gaia DR3 G <= 12 samples committed with the app.
// Sampling this distribution preserves the observed colour population without pretending that a
// procedural backdrop point is a particular Gaia source. Values are Gaia BP-RP and clamp to the
// display palette's documented [-0.5, 4] domain.
const EMPIRICAL_GAIA_BP_RP_ALL = [
  -0.367_964, 0.195_711, 0.467_76, 0.932_031, 1.197_177, 1.396_345, 1.544_299, 1.679_528, 1.821_628,
  1.978_306, 2.159_827, 2.384_356, 2.717_27, 3.006_767, 3.272_77, 3.591_023, 4,
] as const;

interface BackdropGeometryTemplate {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
}

let backdropGeometryTemplate: BackdropGeometryTemplate | null = null;
let milkyWayGeometryTemplate: BackdropGeometryTemplate | null = null;

/**
 * Retains the full point-built cloud during the close traversal, then selects progressively
 * smaller deterministic prefixes once individual grains are sub-pixel. This is rendering LOD
 * only: it never alters the camera, the Galactic reference frame, or particle positions.
 */
export function calculateMilkyWayParticleDrawCount(
  quality: GraphicQuality,
  cameraDistance: number,
  fullParticleCount = getMilkyWayParticleCount(quality),
): number {
  const fullCount = Math.max(1, Math.floor(fullParticleCount));

  if (
    !Number.isFinite(cameraDistance) ||
    cameraDistance <= GALACTIC_DETAIL_MEDIUM_SAMPLE_DISTANCE
  ) {
    return fullCount;
  }

  if (cameraDistance <= GALACTIC_DETAIL_FAR_SAMPLE_DISTANCE) {
    return Math.ceil(fullCount / 2);
  }

  return Math.ceil(fullCount / 4);
}

/**
 * Conserves the cloud's aggregate sub-pixel exposure when its deterministic point prefix is
 * reduced. Close traversal always retains the quality's unmodified density compensation.
 */
export function calculateMilkyWayParticleDensityCompensation(
  quality: GraphicQuality,
  drawCount: number,
  fullParticleCount = getMilkyWayParticleCount(quality),
): number {
  const fullCount = Math.max(1, Math.floor(fullParticleCount));
  const boundedDrawCount = THREE.MathUtils.clamp(Math.floor(drawCount), 1, fullCount);

  return (
    GALACTIC_DETAIL_QUALITY_DENSITY_COMPENSATION[quality] * Math.sqrt(fullCount / boundedDrawCount)
  );
}

function getMilkyWayParticleCount(
  quality: GraphicQuality,
  qualityParticleCount = QUALITY_PARTICLE_COUNTS[quality],
): number {
  return Math.min(
    qualityParticleCount * MILKY_WAY_PARTICLE_GROUP_SIZE[quality],
    MILKY_WAY_PARTICLE_COUNT,
  );
}

function calculateBackdropOpacity(lodLevel: number, cameraDistance: number): number {
  if (lodLevel >= 0 && lodLevel <= 5 && Number.isFinite(cameraDistance) && cameraDistance >= 0) {
    const distance = cameraDistance;
    const entryPresence =
      1 - smoothstep(STELLAR_BACKDROP_ENTRY_FADE_START, STELLAR_BACKDROP_ENTRY_FADE_END, distance);
    const solarSystemExit = smoothstep(
      GALACTIC_DETAIL_NEAR_FADE_START,
      GALACTIC_DETAIL_NEAR_FADE_END,
      distance,
    );

    return BACKDROP_OPACITIES[2] * entryPresence * solarSystemExit;
  }

  return 0;
}

/**
 * Keeps the point-built galaxy alive from the nearby Universe through the categorical LOD 3-to-2
 * and LOD 2-to-1 boundaries. Gaia/HYG add measured local detail to this same spatial field; they do
 * not replace it. Only the deep Solar-system fade and the far extragalactic envelope can remove the
 * point cloud, so categorical LOD boundaries cannot read as scene changes.
 */
export function calculateGalacticDetailTransitionPresence(
  lodLevel: number,
  cameraDistance: number,
): number {
  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    return 0;
  }

  return lodLevel >= 0 && lodLevel <= 5 ? 1 : 0;
}

/**
 * Visibility of the single point-built Milky Way from the nearby Universe to the Solar
 * neighbourhood. Keeping this same batched population alive on both sides of the reference-frame
 * transition prevents the external galaxy from being replaced by a surface or unrelated backdrop.
 */
export function calculateGalacticImmersionDetailOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return 0;
  }
  const distance = Math.max(0, cameraDistance);
  const interiorPresence = smoothstep(
    GALACTIC_DETAIL_NEAR_FADE_START,
    GALACTIC_DETAIL_NEAR_FADE_END,
    distance,
  );
  const exteriorPresence =
    1 - smoothstep(GALACTIC_DETAIL_OUTER_FADE_START, GALACTIC_DETAIL_OUTER_FADE_END, distance);

  return MILKY_WAY_PROCEDURAL_DETAIL_OPACITY * interiorPresence * exteriorPresence;
}

/**
 * Recedes the large-scale arm silhouette over a broad range as its static, co-spatial dust cells
 * resolve. The navigation transform and all point positions remain untouched.
 */
export function calculateGalacticMacroscopicDetailOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return 0;
  }
  const detailOpacity = calculateGalacticImmersionDetailOpacity(cameraDistance);
  const distance = Math.max(0, cameraDistance);
  const macroscopicPresence = THREE.MathUtils.lerp(
    GALACTIC_MACRO_DETAIL_MINIMUM_PRESENCE,
    1,
    smoothstep(GALACTIC_MACRO_DETAIL_HANDOFF_START, GALACTIC_MACRO_DETAIL_HANDOFF_END, distance),
  );

  return detailOpacity * macroscopicPresence;
}

/**
 * Fine, static dust stays readable while the broad silhouette is resolving, then shares the same
 * near-Solar fade as the galaxy so HYG/Gaia can take over without a categorical scene cut.
 */
export function calculateGalacticDustTraversalOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return 0;
  }
  const detailOpacity = calculateGalacticImmersionDetailOpacity(cameraDistance);
  const distance = Math.max(0, cameraDistance);
  const localPresence = THREE.MathUtils.lerp(
    0.65,
    1,
    smoothstep(GALACTIC_DETAIL_NEAR_FADE_START, 320, distance),
  );

  return detailOpacity * localPresence;
}

/**
 * Retires the large dust cells first. At close range only the fine, fixed grains surrounding the
 * observer remain, so the cloud cannot retain a miniature spiral-galaxy silhouette.
 */
export function calculateGalacticDustCoarseDetailPresence(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return 0;
  }

  return smoothstep(
    GALACTIC_DUST_COARSE_DETAIL_FADE_START,
    GALACTIC_DUST_COARSE_DETAIL_FADE_END,
    Math.max(0, cameraDistance),
  );
}

function dampOpacity(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-6 * deltaSeconds));
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}

function createBackdropGeometry(): THREE.BufferGeometry {
  const template = getBackdropGeometryTemplate();
  const geometry = new THREE.BufferGeometry();

  // BufferAttribute wrappers stay instance-owned so disposing one scene releases only its GPU
  // allocations. The deterministic typed arrays are read-only templates shared on the CPU.
  geometry.setAttribute('position', new THREE.BufferAttribute(template.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(template.colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(template.sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(template.alphas, 1));

  return geometry;
}

function getBackdropGeometryTemplate(): BackdropGeometryTemplate {
  backdropGeometryTemplate ??= createBackdropGeometryTemplate();

  return backdropGeometryTemplate;
}

function createBackdropGeometryTemplate(): BackdropGeometryTemplate {
  const count = LOCAL_SKY_PARTICLE_COUNTS.high;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const random = mulberry32(0x0c05_105);

  for (let index = 0; index < count; index += 1) {
    const radius = 7_500 + random() * 1_500;
    const theta = random() * Math.PI * 2;
    const galacticPlaneStar = random() < 0.46;
    const cosine = galacticPlaneStar
      ? THREE.MathUtils.clamp(centeredNoise(random) * 0.12, -0.32, 0.32)
      : random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const offset = index * 3;
    const colorIndex = sampleEmpiricalGaiaColorIndex(random());
    const color = stellarColorIndexToRgb(colorIndex, 'gaia-bp-rp');
    const prominence = Math.pow(random(), 5.5);

    positions[offset] = radius * sine * Math.cos(theta);
    positions[offset + 1] = radius * cosine;
    positions[offset + 2] = radius * sine * Math.sin(theta);
    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    sizes[index] = 0.72 + prominence * 2.35;
    alphas[index] = 0.34 + random() * 0.42 + prominence * 0.2;
  }

  return { positions, colors, sizes, alphas };
}

function sampleEmpiricalGaiaColorIndex(quantile: number): number {
  const values = EMPIRICAL_GAIA_BP_RP_ALL;
  const boundedQuantile = THREE.MathUtils.clamp(quantile, 0, 1);
  let rightIndex = 1;

  while (boundedQuantile > EMPIRICAL_GAIA_BP_RP_QUANTILES[rightIndex]!) {
    rightIndex += 1;
  }
  const leftQuantile = EMPIRICAL_GAIA_BP_RP_QUANTILES[rightIndex - 1]!;
  const rightQuantile = EMPIRICAL_GAIA_BP_RP_QUANTILES[rightIndex]!;
  const progress =
    (boundedQuantile - leftQuantile) / Math.max(rightQuantile - leftQuantile, Number.EPSILON);

  return THREE.MathUtils.lerp(values[rightIndex - 1]!, values[rightIndex]!, progress);
}

function createBackdropMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      opacity: { value: 0.32 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float pointSize;
      attribute float pointAlpha;
      uniform float pixelRatio;
      varying vec3 starColor;
      varying float starAlpha;
      varying float starProminence;

      void main() {
        starColor = color;
        starAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float prominence = clamp((pointSize - 0.72) / 2.35, 0.0, 1.0);
        starProminence = prominence;
        float illustrativeRasterSize = mix(
          ${STELLAR_BACKDROP_MINIMUM_RASTER_SIZE.toFixed(1)},
          ${STELLAR_BACKDROP_PROMINENT_RASTER_SIZE.toFixed(1)},
          pow(prominence, ${STELLAR_BACKDROP_PROMINENCE_EXPONENT.toFixed(2)})
        );
        gl_PointSize = max(
          illustrativeRasterSize * pixelRatio,
          pointSize * pixelRatio
        );
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;
      varying float starProminence;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float stellarHalo = pow(1.0 - radius, 1.45);
        float stellarCore = 1.0 - smoothstep(
          ${STELLAR_BACKDROP_CORE_INNER_RADIUS.toFixed(2)},
          ${STELLAR_BACKDROP_CORE_OUTER_RADIUS.toFixed(2)},
          radius
        );
        float prominenceGain = mix(
          1.0,
          ${STELLAR_BACKDROP_PROMINENCE_ALPHA_GAIN.toFixed(1)},
          starProminence
        );
        float alpha = min(
          1.0,
          min(1.0, stellarHalo * 0.76 + stellarCore * 0.94)
            * starAlpha * opacity * prominenceGain
        );
        vec3 color = starColor
          * (0.86 + stellarCore * 1.46)
          * mix(1.0, 1.12, starProminence);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  material.opacity = 0.32;

  return material;
}

function createMilkyWayGeometry(): THREE.BufferGeometry {
  const template = getMilkyWayGeometryTemplate();
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(template.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(template.colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(template.sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(template.alphas, 1));
  geometry.computeBoundingSphere();

  return geometry;
}

function getMilkyWayGeometryTemplate(): BackdropGeometryTemplate {
  milkyWayGeometryTemplate ??= createMilkyWayGeometryTemplate();

  return milkyWayGeometryTemplate;
}

function createMilkyWayGeometryTemplate(): BackdropGeometryTemplate {
  const count = MILKY_WAY_PARTICLE_COUNT;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const random = mulberry32(0x51a7_f13d);
  const sapphire = new THREE.Color(0x91b7ff);
  const cyan = new THREE.Color(0xc3e0ff);
  const ivory = new THREE.Color(0xffefd4);
  const amber = new THREE.Color(0xffc078);
  const red = new THREE.Color(0xff926b);
  const magenta = new THREE.Color(0xff86ae);
  const sample: MilkyWayParticle = {
    x: 0,
    y: 0,
    z: 0,
    warmth: 0,
    pinkness: 0,
    alpha: 1,
  };

  for (let index = 0; index < count; index += 1) {
    sampleMilkyWayParticle(random, sample);
    const offset = index * 3;

    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
    const sapphireToCyan = smoothstep(0.03, 0.2, sample.warmth);
    const cyanToIvory = smoothstep(0.2, 0.48, sample.warmth);
    const ivoryToAmber = smoothstep(0.48, 0.77, sample.warmth);
    const amberToRed = smoothstep(0.77, 0.98, sample.warmth);
    const coolRed = THREE.MathUtils.lerp(sapphire.r, cyan.r, sapphireToCyan);
    const coolGreen = THREE.MathUtils.lerp(sapphire.g, cyan.g, sapphireToCyan);
    const coolBlue = THREE.MathUtils.lerp(sapphire.b, cyan.b, sapphireToCyan);
    const neutralRed = THREE.MathUtils.lerp(coolRed, ivory.r, cyanToIvory);
    const neutralGreen = THREE.MathUtils.lerp(coolGreen, ivory.g, cyanToIvory);
    const neutralBlue = THREE.MathUtils.lerp(coolBlue, ivory.b, cyanToIvory);
    const warmRed = THREE.MathUtils.lerp(neutralRed, amber.r, ivoryToAmber);
    const warmGreen = THREE.MathUtils.lerp(neutralGreen, amber.g, ivoryToAmber);
    const warmBlue = THREE.MathUtils.lerp(neutralBlue, amber.b, ivoryToAmber);
    const stellarRed = THREE.MathUtils.lerp(warmRed, red.r, amberToRed);
    const stellarGreen = THREE.MathUtils.lerp(warmGreen, red.g, amberToRed);
    const stellarBlue = THREE.MathUtils.lerp(warmBlue, red.b, amberToRed);

    colors[offset] = THREE.MathUtils.lerp(stellarRed, magenta.r, sample.pinkness);
    colors[offset + 1] = THREE.MathUtils.lerp(stellarGreen, magenta.g, sample.pinkness);
    colors[offset + 2] = THREE.MathUtils.lerp(stellarBlue, magenta.b, sample.pinkness);
    // World-space diameters are exaggerated illustrative resolution elements, not stellar radii.
    // Distant samples collectively form the arms; these exact samples resolve during the crossing.
    // Brightness varies across the cloud, while the shader keeps every resolved sample grain-sized.
    sizes[index] = 1.5 + Math.pow(random(), 4.5) * 34;
    alphas[index] = sample.alpha;
  }

  return { positions, colors, sizes, alphas };
}

function createMilkyWayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      viewportHeight: { value: 1 },
      pixelRatio: { value: 1 },
      opacity: { value: 0 },
      qualityDensityCompensation: {
        value: GALACTIC_DETAIL_QUALITY_DENSITY_COMPENSATION.medium,
      },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float pointSize;
      attribute float pointAlpha;
      uniform float viewportHeight;
      uniform float pixelRatio;
      uniform float qualityDensityCompensation;
      varying vec3 starColor;
      varying float starAlpha;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float worldScale = length(modelMatrix[0].xyz);
        float focalPixels = 0.5 * viewportHeight * projectionMatrix[1][1];
        // Project a world-space resolution element, not a literal star or dust-grain radius.
        // Subpixel flux still grows with perspective, but resolved samples remain fine grains.
        float projectedDiameter = pointSize * worldScale * focalPixels
          / max(-viewPosition.z, 0.001);
        // Four pixels support antialiasing around the much smaller luminous core. Never grow a
        // large sprite or amplify its exposure as the camera passes through the cloud.
        float rasterDiameter = ${MILKY_WAY_GRAIN_RASTER_SIZE.toFixed(1)} * pixelRatio;
        float coverage = min(1.0, pow(projectedDiameter / rasterDiameter, 2.0));
        // Fade only individual grains passing the lens, using Euclidean distance so rotation
        // cannot erase a portion of the cloud. The field itself keeps its stable global opacity.
        float distanceToGrain = length(viewPosition.xyz) / max(worldScale, 0.000001);
        float passageOpacity = smoothstep(8.0, 80.0, distanceToGrain);
        starColor = color;
        // A fixed normalization keeps the compact grain legible; it is not an approach boost.
        starAlpha = pointAlpha * coverage * passageOpacity * qualityDensityCompensation
          * ${MILKY_WAY_GRAIN_OPACITY_NORMALIZATION.toFixed(2)};
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = rasterDiameter;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;

      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radiusSquared = dot(point, point);
        if (radiusSquared > 1.0) {
          discard;
        }
        float edge = 1.0 - smoothstep(0.64, 1.0, radiusSquared);
        float grain = exp(-radiusSquared * 10.0);
        float alpha = grain * edge * starAlpha * opacity;
        gl_FragColor = vec4(starColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

interface MilkyWayParticle {
  x: number;
  y: number;
  z: number;
  warmth: number;
  pinkness: number;
  alpha: number;
}

function sampleMilkyWayParticle(random: () => number, target: MilkyWayParticle): void {
  const component = random();

  if (component < MILKY_WAY_BULGE_PARTICLE_FRACTION) {
    sampleGalacticCore(random, target);
  } else if (component < 0.54) {
    sampleSpiralArm(random, target, true);
  } else if (component < 0.72) {
    sampleSpiralArm(random, target, false);
  } else if (component < 0.72 + MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION) {
    sampleLocalSpur(random, target);
  } else {
    sampleDiffuseDisc(random, target);
  }
}

function sampleGalacticCore(random: () => number, target: MilkyWayParticle): void {
  // Old stellar populations make the bulge warmer than the arms, not Sagittarius A* emission.
  // Reference: https://www.esa.int/ESA_Multimedia/Images/2026/06/Euclid_s_view_of_our_galaxy_s_bulge
  // The density, colour gradient and brightness below are illustrative, not catalogue photometry.
  if (random() < 0.56) {
    const longitudinalPosition = centeredNoise(random) * 1_500;
    const envelope = 1 - Math.min(1, Math.abs(longitudinalPosition) / 1_500);
    const transversePosition = centeredNoise(random) * (190 + envelope * 370);
    const barRotation = Math.PI * 0.14;

    target.x =
      Math.cos(barRotation) * longitudinalPosition - Math.sin(barRotation) * transversePosition;
    target.y = centeredNoise(random) * (170 + envelope * 310);
    target.z =
      Math.sin(barRotation) * longitudinalPosition + Math.cos(barRotation) * transversePosition;
    target.warmth = 0.66 + random() * 0.1;
  } else {
    const radius = Math.pow(random(), 0.72) * 1_180;
    const azimuth = random() * Math.PI * 2;
    const elevation = random() * 2 - 1;
    const planarRadius = Math.sqrt(1 - elevation * elevation) * radius;

    target.x = Math.cos(azimuth) * planarRadius;
    target.y = elevation * radius * 0.62;
    target.z = Math.sin(azimuth) * planarRadius;
    // Dense overlapping ivory grains form a small luminous nucleus within the golden bulge.
    target.warmth = 0.5 + smoothstep(0, 780, radius) * 0.24;
  }
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(random, target, 0.12, 0.72);
}

function sampleSpiralArm(random: () => number, target: MilkyWayParticle, major: boolean): void {
  const radialProgress = 0.08 + Math.pow(random(), 0.88) * 0.92;
  const armIndex = (random() < 0.5 ? 0 : 2) + (major ? 0 : 1);
  const nominalRadius = THREE.MathUtils.lerp(620, MILKY_WAY_ADAPTED_VISUAL_RADIUS, radialProgress);
  const armWidth = THREE.MathUtils.lerp(210, major ? 720 : 620, radialProgress);
  const radius = Math.max(180, nominalRadius + centeredNoise(random) * armWidth);
  const cloudPhase = radialProgress * 38 + armIndex * 2.37;
  const cloudStrength = THREE.MathUtils.clamp(
    0.46 + Math.sin(cloudPhase) * 0.26 + Math.sin(cloudPhase * 0.47 + 1.8) * 0.18,
    0.08,
    1,
  );
  const branchProgress = smoothstep(0.38, 0.9, radialProgress);
  const branchOffset =
    random() < (major ? 0.42 : 0.32) * branchProgress
      ? (random() < 0.5 ? -1 : 1) * branchProgress * (0.1 + random() * 0.24)
      : 0;
  const featherOffset =
    Math.sin(radialProgress * (major ? 24 : 31) + armIndex * 1.93) *
    THREE.MathUtils.lerp(0.025, major ? 0.11 : 0.085, radialProgress);
  // Concentrate samples along wandering strands, leaving gaps between them. These are static
  // density variations, not an opaque dust surface or a camera-dependent visibility mask.
  const filament = random() < 0.7;
  const filamentOffset = filament
    ? (random() < 0.52 ? -1 : 1) * THREE.MathUtils.lerp(0.035, 0.075, radialProgress) +
      Math.sin(radialProgress * 52 + armIndex * 1.6) * 0.012
    : 0;
  const angularScatter = filament
    ? THREE.MathUtils.lerp(0.006, 0.02, radialProgress)
    : THREE.MathUtils.lerp(0.05, 0.15, radialProgress);
  const angle =
    calculateIllustrativeMilkyWayArmAngle(radius, armIndex) +
    centeredNoise(random) * angularScatter +
    filamentOffset +
    branchOffset +
    featherOffset;

  target.x = Math.cos(angle) * radius;
  // The illustrative thick component belongs to these same arms at all azimuths, not to a
  // hand-authored camera route. Thin concentrations still define the exterior spiral silhouette.
  const heightScale = random() < 0.22 ? 2_200 : THREE.MathUtils.lerp(180, 560, radialProgress);

  target.y = centeredNoise(random) * heightScale;
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.04 + (1 - radialProgress) * 0.1 + random() * 0.72);
  target.pinkness = random() < (major ? 0.068 : 0.044) * cloudStrength ? 0.38 + random() * 0.44 : 0;
  assignMilkyWayParticleAppearance(
    random,
    target,
    major ? 0.095 : 0.065,
    (major ? 0.68 : 0.46) * (0.3 + cloudStrength * 0.7),
  );
}

function sampleLocalSpur(random: () => number, target: MilkyWayParticle): void {
  const referenceRadius = MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS;
  const radius = THREE.MathUtils.clamp(
    referenceRadius + centeredNoise(random) * 760,
    referenceRadius * 0.64,
    referenceRadius * 1.28,
  );
  const normalizedOffset = Math.abs(radius - referenceRadius) / (referenceRadius * 0.36);
  const coreStrength = 1 - THREE.MathUtils.clamp(normalizedOffset, 0, 1);
  const angle =
    calculateAdaptedMilkyWayLocalSpurAngle(radius) +
    centeredNoise(random) * THREE.MathUtils.lerp(0.075, 0.16, normalizedOffset) +
    Math.sin(radius * 0.013) * 0.025;

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (random() < 0.32 ? 2_000 : 360);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.04 + random() * 0.82;
  target.pinkness = random() < 0.072 ? 0.36 + random() * 0.42 : 0;
  assignMilkyWayParticleAppearance(random, target, 0.11, 0.56 + coreStrength * 0.22);
}

function sampleDiffuseDisc(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = random() < 0.62 ? Math.pow(random(), 1.38) : Math.sqrt(random());
  const radius = 180 + radialProgress * (MILKY_WAY_ADAPTED_VISUAL_RADIUS * 1.02 - 180);
  const angle = random() * Math.PI * 2;
  const thickDisc = random() < 0.45;
  const cloudStrength = THREE.MathUtils.clamp(
    0.62 +
      Math.sin(angle * 3 + radialProgress * 17) * 0.18 +
      Math.sin(angle * 7 - radialProgress * 11 + 0.8) * 0.14,
    0.2,
    1,
  );
  const radialBrightness = THREE.MathUtils.lerp(1.18, 0.64, radialProgress);

  target.x = Math.cos(angle) * radius;
  target.y =
    centeredNoise(random) *
    (thickDisc
      ? THREE.MathUtils.lerp(1_800, 2_500, radialProgress)
      : THREE.MathUtils.lerp(170, 480, radialProgress));
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.06 + (1 - radialProgress) * 0.12 + random() * 0.66);
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(
    random,
    target,
    0.035,
    (thickDisc ? 0.22 : 0.26) * (0.38 + cloudStrength * 0.62) * radialBrightness,
  );
}

function assignMilkyWayParticleAppearance(
  random: () => number,
  target: MilkyWayParticle,
  brightProbability: number,
  alphaScale: number,
): void {
  if (random() < brightProbability) {
    const prominence = Math.pow(random(), 4.1);

    target.alpha = alphaScale * (0.58 + random() * 0.32 + prominence * 0.1);

    return;
  }

  target.alpha = alphaScale * (0.22 + random() * 0.32);
}

function centeredNoise(random: () => number): number {
  return random() + random() + random() - 1.5;
}

function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b_79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
