import * as THREE from 'three';
import { type GraphicQuality, type Vector3Like } from '../../data/models/universe.models';
import {
  calculateMilkyWaySceneScale,
  MILKY_WAY_DIAMETER_LIGHT_YEARS,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
} from '../coordinates/galaxy-scale-model';
import {
  calculateStellarNeighborhoodReveal,
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
import { type PerformanceManager } from '../performance/performance-manager';
import {
  calculateAdaptedMilkyWayLocalSpurAngle,
  calculateIllustrativeMilkyWayArmAngle,
  MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES,
  MILKY_WAY_ADAPTED_VISUAL_RADIUS,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS,
} from './milky-way-density-model';

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
  private readonly backdropGeometry = createBackdropGeometry(LOCAL_SKY_PARTICLE_COUNTS.high);
  private readonly backdropMaterial = createBackdropMaterial();
  private readonly milkyWayGeometry = createMilkyWayGeometry(MILKY_WAY_PARTICLE_COUNT);
  private readonly milkyWayMaterial = createMilkyWayMaterial();
  private readonly backdrop = new THREE.Points(this.backdropGeometry, this.backdropMaterial);
  private readonly milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
  private readonly observerWorldPosition = new THREE.Vector3();
  private readonly stellarNeighborhoodOrigin = new THREE.Vector3();
  private stellarNeighborhoodRadialScale = 1;
  private stellarNeighborhoodVerticalScale = 1;
  private stellarNeighborhoodOriginScale = 1;
  private previousCameraDistance: number | null = null;
  private travelMotion = 0;

  constructor(
    private readonly spaceRoot: THREE.Group,
    private readonly stellarNeighborhoodRoot: THREE.Group,
    private readonly performanceManager: PerformanceManager,
  ) {
    this.stellarNeighborhoodRoot.userData['scaleTransition'] =
      'readable-to-physical-galactic-disc-containment';
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
      'restrained-unresolved-star-floor-through-galactic-to-stellar-handoff';
    this.backdrop.userData['colorTreatment'] =
      'illustrative-spectral-variety-with-sapphire-ivory-amber-and-red-stars';
    this.backdrop.userData['luminanceTreatment'] =
      'lifted-point-cores-without-a-diffuse-background-veil';

    this.milkyWay.name = 'illustrative-milky-way';
    this.milkyWay.visible = false;
    this.milkyWay.renderOrder = 3;
    this.milkyWay.userData['scientificConfidence'] = 'illustrative';
    this.milkyWay.userData['visualStructure'] =
      'continuous-illustrative-galactocentric-four-arm-volume';
    this.milkyWay.userData['structureOrigin'] = 'galactic-center';
    this.milkyWay.userData['spiralArmCount'] = MILKY_WAY_ARM_COUNT;
    this.milkyWay.userData['spiralPitchDegrees'] = MILKY_WAY_ARM_PITCH_DEGREES;
    this.milkyWay.userData['adaptedVisualPitchDegrees'] = MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES;
    this.milkyWay.userData['visualRole'] = 'galactic-scale-stellar-detail';
    this.milkyWay.userData['visualStyle'] = 'batched-three-dimensional-stellar-detail';
    this.milkyWay.userData['representationTechnique'] = 'single-batched-point-cloud';
    this.milkyWay.userData['rasterTextureRole'] = 'none-at-galactic-detail-scale';
    this.milkyWay.userData['verticalEnvelope'] = 'thin-and-thick-disc-detail';
    this.milkyWay.userData['densityTreatment'] =
      'branched-stellar-disc-with-interior-unresolved-star-floor';
    this.milkyWay.userData['flythroughTreatment'] =
      'static-multi-depth-thick-disc-entry-shell-and-near-passage-tracers-for-motion-parallax';
    this.milkyWay.userData['flythroughParticleFraction'] =
      MILKY_WAY_FLYTHROUGH_PARTICLES_PER_GROUP / MILKY_WAY_PARTICLE_GROUP_SIZE;
    this.milkyWay.userData['flythroughCorridorParticleFraction'] =
      MILKY_WAY_CORRIDOR_PARTICLES_PER_GROUP / MILKY_WAY_PARTICLE_GROUP_SIZE;
    this.milkyWay.userData['flythroughNearPassageParticleFraction'] =
      MILKY_WAY_NEAR_PASSAGE_PARTICLES_PER_GROUP / MILKY_WAY_PARTICLE_GROUP_SIZE;
    this.milkyWay.userData['flythroughCorridorTreatment'] =
      'static-rotational-entry-height-shell-with-stratified-near-passage-core';
    this.milkyWay.userData['flythroughNearPassageTreatment'] =
      'quality-nested-cylindrical-stratification-along-the-calibrated-entry-height-profile';
    this.milkyWay.userData['motionCue'] =
      'multi-depth-parallax-with-motion-gated-short-near-star-trails';
    this.milkyWay.userData['interiorClarityTreatment'] =
      'soft-morphology-suppression-with-reinforced-crisp-proximity-and-background-stars';
    this.milkyWay.userData['interiorStellarOpacityFloor'] = GALACTIC_DETAIL_INTERIOR_PRESENCE_FLOOR;
    this.milkyWay.userData['colorStructure'] =
      'warm-ivory-integrated-light-sapphire-young-stars-amber-core-and-magenta-hii';
    this.milkyWay.userData['luminanceTreatment'] =
      'preserved-dark-field-with-kind-weighted-stellar-core-luminance';
    this.milkyWay.userData['localSpurTreatment'] =
      'illustrative-branch-anchored-at-the-solar-galactocentric-radius';
    this.milkyWay.userData['localSpurParticleFraction'] = MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION;
    this.milkyWay.userData['apparentScaleTreatment'] =
      'illustrative-immersive-envelope-over-canonical-reference-frame';
    this.milkyWay.userData['physicalDiameterLightYears'] = MILKY_WAY_DIAMETER_LIGHT_YEARS;
    this.milkyWay.userData['authoringDiameter'] = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER;

    this.spaceRoot.add(this.backdrop, this.milkyWay);
  }

  public setStellarOrigin(position: Vector3Like): void {
    this.stellarNeighborhoodOrigin.set(position.x, position.y, position.z);
    this.applyStellarNeighborhoodOrigin();
  }

  public setQuality(quality: GraphicQuality): void {
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS[quality]);
    this.milkyWayGeometry.setDrawRange(
      0,
      Math.min(
        this.performanceManager.getParticleCount(quality) * MILKY_WAY_PARTICLE_GROUP_SIZE,
        MILKY_WAY_PARTICLE_COUNT,
      ),
    );
  }

  public setPixelRatio(pixelRatio: number): void {
    const clampedPixelRatio = THREE.MathUtils.clamp(pixelRatio, 0.5, 1.5);

    this.backdropMaterial.uniforms['pixelRatio']!.value = clampedPixelRatio;
    this.milkyWayMaterial.uniforms['pixelRatio']!.value = clampedPixelRatio;
  }

  public update(frame: GalacticTransitionFrame): void {
    this.synchronizeBackdropWithObserver(frame.observerPosition);
    const milkyWaySceneScale = calculateMilkyWaySceneScale(frame.cameraDistance);
    const transitionVisible = frame.lodLevel >= 1 && frame.lodLevel <= 4;
    const detailStrength = calculateGalacticImmersionDetailOpacity(frame.cameraDistance);
    const targetOpacity = transitionVisible
      ? detailStrength * Math.min(1, Math.max(0, frame.galaxyRadiance))
      : 0;
    const targetStellarNeighborhoodScale = calculateStellarNeighborhoodSceneScale(
      frame.cameraDistance,
      this.stellarNeighborhoodOrigin.length(),
    );
    const targetBackdropOpacity =
      calculateBackdropOpacity(frame.lodLevel, frame.cameraDistance) * frame.starRadiance;

    const currentMilkyWayOpacity = this.milkyWayMaterial.uniforms['opacity']!.value as number;
    const milkyWayOpacity = dampOpacity(currentMilkyWayOpacity, targetOpacity, frame.deltaSeconds);

    this.milkyWayMaterial.uniforms['opacity']!.value = milkyWayOpacity;
    this.milkyWayMaterial.uniforms['cameraDistance']!.value = Number.isFinite(frame.cameraDistance)
      ? Math.max(0, frame.cameraDistance)
      : GALACTIC_DETAIL_OUTER_FADE_END;
    this.updateTravelMotion(frame.cameraDistance, frame.deltaSeconds);
    this.milkyWay.visible = milkyWayOpacity > MINIMUM_VISIBLE_OPACITY;
    this.milkyWay.scale.setScalar(milkyWaySceneScale.modelScale);
    this.milkyWay.userData['modelScale'] = milkyWaySceneScale.modelScale;
    this.milkyWay.userData['worldDiameter'] = milkyWaySceneScale.worldDiameter;
    this.milkyWay.userData['physicalWorldDiameter'] = milkyWaySceneScale.physicalWorldDiameter;
    this.milkyWay.userData['visualScaleFactor'] = milkyWaySceneScale.visualScaleFactor;
    this.milkyWay.userData['visualSceneUnitsPerKiloparsec'] =
      milkyWaySceneScale.visualSceneUnitsPerKiloparsec;
    this.milkyWay.userData['referenceFrameSceneUnitsPerKiloparsec'] =
      milkyWaySceneScale.referenceFrameSceneUnitsPerKiloparsec;
    this.milkyWay.userData['referenceFrameBlend'] = milkyWaySceneScale.referenceFrameBlend;
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
  }

  private updateTravelMotion(cameraDistance: number, deltaSeconds: number): void {
    const normalizedDistance = Number.isFinite(cameraDistance)
      ? Math.max(cameraDistance, Number.EPSILON)
      : null;
    const logarithmicStep =
      normalizedDistance !== null && this.previousCameraDistance !== null
        ? Math.abs(Math.log(normalizedDistance / this.previousCameraDistance))
        : 0;
    const targetMotion = smoothstep(0.000_35, 0.01, logarithmicStep);
    const dampingRate = targetMotion > this.travelMotion ? 24 : 8;

    if (deltaSeconds > 0) {
      this.travelMotion +=
        (targetMotion - this.travelMotion) * (1 - Math.exp(-dampingRate * deltaSeconds));
    }
    this.milkyWayMaterial.uniforms['travelMotion']!.value = this.travelMotion;
    this.previousCameraDistance = normalizedDistance;
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
/**
 * Every ten-particle group preserves five morphology samples from the previous visual and adds one
 * broad-disc tracer, two entry-shell tracers, and two stratified near-passage tracers. Consequently
 * each quality keeps its former arm/core density while the camera crosses several readable depth
 * planes instead of seeing the extra stars collapse into one distant backdrop.
 */
const MILKY_WAY_PARTICLE_GROUP_SIZE = 10;
const MILKY_WAY_FLYTHROUGH_PARTICLES_PER_GROUP = 5;
const MILKY_WAY_NEAR_PASSAGE_PARTICLES_PER_GROUP = 2;
const MILKY_WAY_ENTRY_CORRIDOR_PARTICLES_PER_GROUP = 2;
const MILKY_WAY_CORRIDOR_PARTICLES_PER_GROUP =
  MILKY_WAY_NEAR_PASSAGE_PARTICLES_PER_GROUP + MILKY_WAY_ENTRY_CORRIDOR_PARTICLES_PER_GROUP;
const MILKY_WAY_PARTICLE_COUNT = 280_000;
const MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION = 0.14;
const BACKDROP_OPACITIES = [0.32, 0.42, 0.24, 0, 0, 0, 0] as const;
const GALACTIC_DETAIL_NEAR_FADE_START = 70;
const GALACTIC_DETAIL_NEAR_FADE_END = 260;
const GALACTIC_DETAIL_OUTER_FADE_START = 10_000;
const GALACTIC_DETAIL_OUTER_FADE_END = 40_000;
const MINIMUM_VISIBLE_OPACITY = 0.004;
const MILKY_WAY_PROCEDURAL_DETAIL_OPACITY = 0.96;
const GALACTIC_DETAIL_INTERIOR_PRESENCE_FLOOR = 0.42;
const STELLAR_BACKDROP_INTERIOR_PRESENCE_FLOOR = 0.58;
const STELLAR_BACKDROP_INTERIOR_FADE_START = 1_400;
const STELLAR_BACKDROP_INTERIOR_FADE_END = 2_800;

function calculateBackdropOpacity(lodLevel: number, cameraDistance: number): number {
  if (lodLevel >= 2 && lodLevel <= 4) {
    const stellarNeighborhoodReveal = calculateStellarNeighborhoodReveal(cameraDistance);
    const normalizedDistance = Number.isFinite(cameraDistance)
      ? Math.max(0, cameraDistance)
      : STELLAR_BACKDROP_INTERIOR_FADE_END;
    const interiorPresence =
      STELLAR_BACKDROP_INTERIOR_PRESENCE_FLOOR *
      (1 -
        smoothstep(
          STELLAR_BACKDROP_INTERIOR_FADE_START,
          STELLAR_BACKDROP_INTERIOR_FADE_END,
          normalizedDistance,
        ));

    return BACKDROP_OPACITIES[2] * Math.max(stellarNeighborhoodReveal, interiorPresence);
  }

  return BACKDROP_OPACITIES[lodLevel] ?? 0;
}

/**
 * Visibility of the co-spatial granular structure from the Local Group to the Solar neighbourhood.
 * Keeping this same batched volume alive on both sides of the reference-frame transition prevents
 * the external galaxy from being replaced by an unrelated stellar backdrop during the dive.
 */
export function calculateGalacticImmersionDetailOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return 0;
  }
  const distance = Math.max(0, cameraDistance);
  const nearPresence = smoothstep(
    GALACTIC_DETAIL_NEAR_FADE_START,
    GALACTIC_DETAIL_NEAR_FADE_END,
    distance,
  );
  const interiorPresence = THREE.MathUtils.lerp(
    GALACTIC_DETAIL_INTERIOR_PRESENCE_FLOOR,
    1,
    nearPresence,
  );
  const exteriorPresence =
    1 - smoothstep(GALACTIC_DETAIL_OUTER_FADE_START, GALACTIC_DETAIL_OUTER_FADE_END, distance);

  return MILKY_WAY_PROCEDURAL_DETAIL_OPACITY * interiorPresence * exteriorPresence;
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

function createBackdropGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const random = mulberry32(0x0c05_105);
  const cool = new THREE.Color(0x6f9fff);
  const neutral = new THREE.Color(0xffe8bd);
  const warm = new THREE.Color(0xffa447);
  const red = new THREE.Color(0xff654d);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const radius = 7_500 + random() * 1_500;
    const theta = random() * Math.PI * 2;
    const galacticPlaneStar = random() < 0.46;
    const cosine = galacticPlaneStar
      ? THREE.MathUtils.clamp(centeredNoise(random) * 0.12, -0.32, 0.32)
      : random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const offset = index * 3;
    const temperature = random();
    const prominence = Math.pow(random(), 5.5);

    positions[offset] = radius * sine * Math.cos(theta);
    positions[offset + 1] = radius * cosine;
    positions[offset + 2] = radius * sine * Math.sin(theta);
    if (temperature < 0.18) {
      color.lerpColors(cool, neutral, Math.pow(temperature / 0.18, 1.8) * 0.42);
    } else if (temperature < 0.7) {
      color.copy(neutral).lerp(cool, Math.abs(temperature - 0.44) * 0.1);
    } else if (temperature < 0.94) {
      color.lerpColors(neutral, warm, 0.45 + ((temperature - 0.7) / 0.24) * 0.55);
    } else {
      color.lerpColors(warm, red, (temperature - 0.94) / 0.06);
    }
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 0.72 + prominence * 2.35;
    alphas[index] = 0.34 + random() * 0.42 + prominence * 0.2;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));

  return geometry;
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

      void main() {
        starColor = color;
        starAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(0.8, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float stellarHalo = pow(1.0 - radius, 1.7);
        float stellarCore = 1.0 - smoothstep(0.0, 0.2, radius);
        float alpha = min(1.0, stellarHalo * 0.7 + stellarCore * 0.85)
          * starAlpha * opacity;
        vec3 color = starColor * (0.86 + stellarCore * 1.46);

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

function createMilkyWayGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const softness = new Float32Array(count);
  const flythrough = new Float32Array(count);
  const random = mulberry32(0x51a7_f13d);
  const cool = new THREE.Color(0x6198ff);
  const neutral = new THREE.Color(0xffe4b8);
  const warm = new THREE.Color(0xff9638);
  const pink = new THREE.Color(0xf04f91);
  const sample: MilkyWayParticle = {
    x: 0,
    y: 0,
    z: 0,
    warmth: 0,
    pinkness: 0,
    size: 1,
    alpha: 1,
    softness: 0,
    flythrough: 0,
  };

  for (let index = 0; index < count; index += 1) {
    const groupIndex = index % MILKY_WAY_PARTICLE_GROUP_SIZE;

    if (groupIndex < MILKY_WAY_NEAR_PASSAGE_PARTICLES_PER_GROUP) {
      const groupOrdinal = Math.floor(index / MILKY_WAY_PARTICLE_GROUP_SIZE);
      const nearPassageOrdinal =
        groupOrdinal * MILKY_WAY_NEAR_PASSAGE_PARTICLES_PER_GROUP + groupIndex;

      sampleGalacticNearPassageParticle(random, sample, nearPassageOrdinal);
    } else if (groupIndex < MILKY_WAY_CORRIDOR_PARTICLES_PER_GROUP) {
      sampleGalacticEntryCorridorParticle(random, sample);
    } else if (groupIndex < MILKY_WAY_FLYTHROUGH_PARTICLES_PER_GROUP) {
      sampleGalacticFlythroughParticle(random, sample);
    } else {
      sampleMilkyWayParticle(random, sample);
    }
    const offset = index * 3;

    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
    const coolMix = (1 - smoothstep(0.1, 0.46, sample.warmth)) * 0.82;
    const warmMix = smoothstep(0.48, 0.88, sample.warmth);
    const neutralRed = neutral.r + (cool.r - neutral.r) * coolMix;
    const neutralGreen = neutral.g + (cool.g - neutral.g) * coolMix;
    const neutralBlue = neutral.b + (cool.b - neutral.b) * coolMix;
    const red = neutralRed + (warm.r - neutralRed) * warmMix;
    const green = neutralGreen + (warm.g - neutralGreen) * warmMix;
    const blue = neutralBlue + (warm.b - neutralBlue) * warmMix;

    colors[offset] = red + (pink.r - red) * sample.pinkness;
    colors[offset + 1] = green + (pink.g - green) * sample.pinkness;
    colors[offset + 2] = blue + (pink.b - blue) * sample.pinkness;
    sizes[index] = sample.size;
    alphas[index] = sample.alpha;
    softness[index] = sample.softness;
    flythrough[index] = sample.flythrough;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointSoftness', new THREE.BufferAttribute(softness, 1));
  geometry.setAttribute('pointFlythrough', new THREE.BufferAttribute(flythrough, 1));

  return geometry;
}

function createMilkyWayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      opacity: { value: 0 },
      cameraDistance: { value: GALACTIC_DETAIL_OUTER_FADE_END },
      travelMotion: { value: 0 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float pointSoftness;
      attribute float pointFlythrough;
      uniform float pixelRatio;
      uniform float cameraDistance;
      uniform float travelMotion;
      varying vec3 starColor;
      varying float starAlpha;
      varying float starSoftness;
      varying vec2 starTrailDirection;
      varying float starTrailStrength;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float distanceToCamera = max(length(viewPosition.xyz), 1.0);
        float immersionGrowth = clamp(pow(1250.0 / distanceToCamera, 0.22), 0.86, 2.8);
        float flythroughJourney =
          (1.0 - smoothstep(3600.0, 6200.0, cameraDistance))
          * smoothstep(360.0, 900.0, cameraDistance);
        float broadFlythroughMask =
          step(0.5, pointFlythrough) * (1.0 - step(1.5, pointFlythrough));
        float corridorFlythroughMask =
          step(1.5, pointFlythrough) * (1.0 - step(2.5, pointFlythrough));
        float nearPassageMask = step(2.5, pointFlythrough);
        float broadFlythroughProximity = 1.0 - smoothstep(220.0, 1100.0, distanceToCamera);
        float corridorFlythroughProximity = 1.0 - smoothstep(500.0, 2300.0, distanceToCamera);
        float nearPassageProximity = 1.0 - smoothstep(45.0, 420.0, distanceToCamera);
        float broadFlythroughEmphasis =
          broadFlythroughMask * flythroughJourney * broadFlythroughProximity;
        float corridorFlythroughEmphasis =
          corridorFlythroughMask * flythroughJourney * corridorFlythroughProximity;
        float nearPassageEmphasis =
          nearPassageMask * flythroughJourney * nearPassageProximity;
        float flythroughEmphasis = max(
          max(broadFlythroughEmphasis, corridorFlythroughEmphasis),
          nearPassageEmphasis
        );
        float flythroughGrowth = clamp(900.0 / distanceToCamera, 1.0, 8.0);
        float corridorFlythroughGrowth = clamp(2200.0 / distanceToCamera, 1.0, 18.0);
        float nearPassageGrowth = clamp(3400.0 / distanceToCamera, 1.0, 36.0);
        float perspectiveGrowth = mix(
          immersionGrowth,
          max(immersionGrowth, flythroughGrowth),
          broadFlythroughEmphasis
        );
        perspectiveGrowth = mix(
          perspectiveGrowth,
          max(perspectiveGrowth, corridorFlythroughGrowth),
          corridorFlythroughEmphasis
        );
        perspectiveGrowth = mix(
          perspectiveGrowth,
          max(perspectiveGrowth, nearPassageGrowth),
          nearPassageEmphasis
        );

        float stellarExposure = 1.08
          + broadFlythroughMask * 0.18
          + corridorFlythroughMask * 0.42
          + nearPassageMask * 0.62;
        starColor = color * stellarExposure;
        float interiorClarity =
          1.0 - smoothstep(1750.0, 3600.0, cameraDistance);
        float morphologyMask = 1.0 - step(0.5, pointFlythrough);
        float softMorphologyMask =
          morphologyMask * smoothstep(0.32, 0.7, pointSoftness);
        float interiorMorphologyVisibility = mix(
          1.0,
          mix(0.7, 0.12, softMorphologyMask),
          interiorClarity * morphologyMask
        );
        float immersionVisibility = mix(
          1.0,
          1.32,
          1.0 - smoothstep(700.0, 4200.0, cameraDistance)
        );

        float broadVisibility = mix(
          1.0,
          mix(0.018, 1.75, pow(broadFlythroughProximity, 2.0)),
          broadFlythroughMask * flythroughJourney
        );
        float corridorVisibility = mix(
          1.0,
          flythroughJourney * mix(0.008, 1.45, pow(corridorFlythroughProximity, 1.45)),
          corridorFlythroughMask
        );
        float nearPassageVisibility = mix(
          1.0,
          flythroughJourney * mix(0.001, 2.4, pow(nearPassageProximity, 1.4)),
          nearPassageMask
        );
        starAlpha = pointAlpha
          * immersionVisibility
          * interiorMorphologyVisibility
          * broadVisibility
          * corridorVisibility
          * nearPassageVisibility;
        starSoftness = mix(
          max(pointSoftness, smoothstep(1.8, 2.8, immersionGrowth) * 0.18),
          min(pointSoftness, 0.08),
          flythroughEmphasis
        );
        vec4 clipPosition = projectionMatrix * viewPosition;
        vec2 projectedPosition = clipPosition.xy / max(abs(clipPosition.w), 0.0001);
        float projectedRadius = length(projectedPosition);
        starTrailDirection = projectedRadius > 0.001
          ? projectedPosition / projectedRadius
          : vec2(1.0, 0.0);
        starTrailStrength = nearPassageEmphasis * travelMotion;
        gl_Position = clipPosition;
        gl_PointSize = clamp(
          pointSize * pixelRatio * perspectiveGrowth * mix(1.0, 1.45, starTrailStrength),
          0.7,
          44.0 * pixelRatio
        );
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;
      varying float starSoftness;
      varying vec2 starTrailDirection;
      varying float starTrailStrength;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float edge = 1.0 - smoothstep(0.8, 1.0, radius);
        float gaussian = exp(-radius * radius * mix(13.5, 2.8, starSoftness)) * edge;
        float core = (1.0 - smoothstep(0.0, 0.13, radius))
          * (1.0 - starSoftness * 0.88);
        vec2 trailNormal = vec2(-starTrailDirection.y, starTrailDirection.x);
        float trailLongitudinal = abs(dot(point, starTrailDirection));
        float trailTransverse = dot(point, trailNormal);
        float shortTrail = exp(-trailTransverse * trailTransverse * 82.0)
          * (1.0 - smoothstep(0.1, 0.88, trailLongitudinal))
          * edge
          * starTrailStrength;
        float alpha = (gaussian * mix(0.54, 0.39, starSoftness) + core * 0.9 + shortTrail * 0.28)
          * starAlpha * opacity;
        vec3 color = starColor
          * (mix(1.12, 0.64, starSoftness) + core * 1.55 + shortTrail * 0.4);

        gl_FragColor = vec4(color, alpha);
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
  size: number;
  alpha: number;
  softness: number;
  flythrough: number;
}

function sampleMilkyWayParticle(random: () => number, target: MilkyWayParticle): void {
  target.flythrough = 0;
  const component = random();

  if (component < 0.1) {
    sampleGalacticCore(random, target);
  } else if (component < 0.42) {
    sampleSpiralArm(random, target, true);
  } else if (component < 0.5) {
    sampleSpiralArm(random, target, false);
  } else if (component < 0.5 + MILKY_WAY_LOCAL_SPUR_PARTICLE_FRACTION) {
    sampleLocalSpur(random, target);
  } else {
    sampleDiffuseDisc(random, target);
  }
}

/**
 * Illustrative broad-disc population used only as a motion cue. The particles stay fixed in the
 * galactocentric frame; they receive no independent particle animation or camera-speed multiplier.
 * Their apparent sweep is the perspective cue produced while the camera crosses the continuously
 * scaled illustrative Galactic frame. They do not represent catalogued individual stars.
 */
function sampleGalacticFlythroughParticle(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.sqrt(random());
  const radius = THREE.MathUtils.lerp(320, MILKY_WAY_ADAPTED_VISUAL_RADIUS, radialProgress);
  const angle = random() * Math.PI * 2;
  const verticalHalfSpan = THREE.MathUtils.lerp(820, 1_450, radialProgress);

  target.x = Math.cos(angle) * radius;
  target.y = (random() * 2 - 1) * verticalHalfSpan;
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.04 + (1 - radialProgress) * 0.08 + random() * 0.82);
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(random, target, 0.22, 0.68, 1.75, 0.72);
  target.softness = Math.min(target.softness, 0.12);
  target.flythrough = 1;
}

/**
 * Illustrative static shell following the elevation profile of the reversible Galactic entry.
 * It is rotationally symmetric, so it does not bake one screen-space camera azimuth into the
 * galaxy. The shell is almost invisible at a distance and only resolves into individual stars as
 * perspective carries the camera through it. These are motion-cue particles, not catalogued stars.
 */
function sampleGalacticEntryCorridorParticle(random: () => number, target: MilkyWayParticle): void {
  const minimumRadius = 1_000;
  const maximumRadius = 5_200;
  const radius = minimumRadius * Math.pow(maximumRadius / minimumRadius, random());
  const angle = random() * Math.PI * 2;
  const entryHeightProgress = smoothstep(1_000, 2_600, radius);
  const entryHeight = calculateGalacticEntryHeight(radius);
  const verticalScatter = THREE.MathUtils.lerp(190, 270, entryHeightProgress);

  target.x = Math.cos(angle) * radius;
  target.y = entryHeight + centeredNoise(random) * verticalScatter;
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.04 + (1 - entryHeightProgress) * 0.08 + random() * 0.78);
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(random, target, 0.32, 0.82, 2.25, 0.9);
  target.softness = Math.min(target.softness, 0.065);
  target.flythrough = 2;
}

/**
 * Narrow, stratified core of the illustrative entry corridor. Each quality tier contributes a
 * complete radius-by-azimuth lattice with jittered cells and rotated radial bands, rather than a
 * random subset that can leave long holes in the foreground. The piecewise height profile is
 * calibrated against the reversible Galactic choreography while remaining rotationally symmetric.
 * Points stay fixed in the Galactic frame and are not catalogued stars.
 */
function sampleGalacticNearPassageParticle(
  random: () => number,
  target: MilkyWayParticle,
  sequenceIndex: number,
): void {
  const minimumRadius = 850;
  const maximumRadius = 6_500;
  const tier = resolveNearPassageTier(sequenceIndex);
  const radialIndex = Math.floor(tier.index / tier.angularSegments);
  const angularIndex = tier.index % tier.angularSegments;
  const radialPhase = (radialIndex + 0.5 + (random() - 0.5) * 0.55) / tier.radialSegments;
  const angularPhase = fractionalPart(
    (angularIndex + 0.5 + (random() - 0.5) * 0.55) / tier.angularSegments +
      radialIndex * 0.618_033_988_749_894_8 +
      tier.rotation,
  );
  const radius = minimumRadius * Math.pow(maximumRadius / minimumRadius, radialPhase);
  const angle = angularPhase * Math.PI * 2;
  const entryHeightProgress = smoothstep(1_000, 2_600, radius);
  const entryHeight = calculateGalacticEntryHeight(radius);
  const verticalScatter = THREE.MathUtils.lerp(42, 62, entryHeightProgress);

  target.x = Math.cos(angle) * radius;
  target.y = entryHeight + centeredNoise(random) * verticalScatter;
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.03 + (1 - entryHeightProgress) * 0.1 + random() * 0.8);
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(random, target, 0.4, 0.78, 2.75, 1.02);
  target.softness = Math.min(target.softness, 0.035);
  target.flythrough = 3;
}

function resolveNearPassageTier(sequenceIndex: number): {
  readonly index: number;
  readonly radialSegments: number;
  readonly angularSegments: number;
  readonly rotation: number;
} {
  if (sequenceIndex < 12_000) {
    return { index: sequenceIndex, radialSegments: 100, angularSegments: 120, rotation: 0 };
  }
  if (sequenceIndex < 28_000) {
    return {
      index: sequenceIndex - 12_000,
      radialSegments: 100,
      angularSegments: 160,
      rotation: 0.381_966_011_250_105_2,
    };
  }

  return {
    index: sequenceIndex - 28_000,
    radialSegments: 140,
    angularSegments: 200,
    rotation: 0.754_877_666_246_692_7,
  };
}

function calculateGalacticEntryHeight(radius: number): number {
  if (radius <= 1_200) {
    return interpolateSmoothly(850, 1_200, 25, 40, radius);
  }
  if (radius <= 1_450) {
    return interpolateSmoothly(1_200, 1_450, 40, 85, radius);
  }
  if (radius <= 1_700) {
    return interpolateSmoothly(1_450, 1_700, 85, 210, radius);
  }
  if (radius <= 2_000) {
    return interpolateSmoothly(1_700, 2_000, 210, 470, radius);
  }
  if (radius <= 2_300) {
    return interpolateSmoothly(2_000, 2_300, 470, 840, radius);
  }
  if (radius <= 2_700) {
    return interpolateSmoothly(2_300, 2_700, 840, 980, radius);
  }

  return interpolateSmoothly(2_700, 4_200, 980, 925, radius);
}

function interpolateSmoothly(
  minimum: number,
  maximum: number,
  start: number,
  end: number,
  value: number,
): number {
  return THREE.MathUtils.lerp(start, end, smoothstep(minimum, maximum, value));
}

function sampleGalacticCore(random: () => number, target: MilkyWayParticle): void {
  if (random() < 0.36) {
    const longitudinalPosition = centeredNoise(random) * 1_500;
    const envelope = 1 - Math.min(1, Math.abs(longitudinalPosition) / 1_500);
    const transversePosition = centeredNoise(random) * (190 + envelope * 370);
    const barRotation = Math.PI * 0.14;

    target.x =
      Math.cos(barRotation) * longitudinalPosition - Math.sin(barRotation) * transversePosition;
    target.y = centeredNoise(random) * (170 + envelope * 310);
    target.z =
      Math.sin(barRotation) * longitudinalPosition + Math.cos(barRotation) * transversePosition;
    target.warmth = 0.62 + envelope * 0.28 + random() * 0.08;
  } else {
    const radius = Math.pow(random(), 1.85) * 1_180;
    const azimuth = random() * Math.PI * 2;
    const elevation = random() * 2 - 1;
    const planarRadius = Math.sqrt(1 - elevation * elevation) * radius;

    target.x = Math.cos(azimuth) * planarRadius;
    target.y = elevation * radius * 0.62;
    target.z = Math.sin(azimuth) * planarRadius;
    target.warmth = 0.68 + (1 - radius / 1_180) * 0.27;
  }
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(random, target, 0.08, 0.76, 1.7, 0.17);
  softenCloudParticle(random, target, 0.62, 3.6, 0.46);
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
  const angle =
    calculateIllustrativeMilkyWayArmAngle(radius, armIndex) +
    centeredNoise(random) * THREE.MathUtils.lerp(0.11, major ? 0.27 : 0.31, radialProgress) +
    branchOffset +
    featherOffset;

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * THREE.MathUtils.lerp(135, major ? 430 : 360, radialProgress);
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.04 + (1 - radialProgress) * 0.1 + random() * 0.72);
  target.pinkness = random() < (major ? 0.035 : 0.022) * cloudStrength ? 0.3 + random() * 0.38 : 0;
  assignMilkyWayParticleAppearance(
    random,
    target,
    major ? 0.095 : 0.065,
    major ? 0.58 : 0.54,
    major ? 1.46 : 1.3,
    (major ? 0.68 : 0.46) * (0.3 + cloudStrength * 0.7),
  );
  softenCloudParticle(random, target, major ? 0.18 : 0.24, 2.7, 0.7);
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
  target.y = centeredNoise(random) * THREE.MathUtils.lerp(150, 330, 1 - coreStrength);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.04 + random() * 0.82;
  target.pinkness = random() < 0.04 ? 0.28 + random() * 0.36 : 0;
  assignMilkyWayParticleAppearance(random, target, 0.11, 0.64, 1.7, 0.56 + coreStrength * 0.22);
  softenCloudParticle(random, target, 0.2, 2.6, 0.7);
}

function sampleDiffuseDisc(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = random() < 0.62 ? Math.pow(random(), 1.38) : Math.sqrt(random());
  const radius = 180 + radialProgress * (MILKY_WAY_ADAPTED_VISUAL_RADIUS * 1.02 - 180);
  const angle = random() * Math.PI * 2;
  const thickDisc = random() < 0.22;
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
      ? THREE.MathUtils.lerp(520, 1_050, radialProgress)
      : THREE.MathUtils.lerp(170, 480, radialProgress));
  target.z = Math.sin(angle) * radius;
  target.warmth = Math.min(1, 0.06 + (1 - radialProgress) * 0.12 + random() * 0.66);
  target.pinkness = 0;
  assignMilkyWayParticleAppearance(
    random,
    target,
    0.035,
    0.54,
    1.22,
    (thickDisc ? 0.24 : 0.4) * (0.38 + cloudStrength * 0.62) * radialBrightness,
  );
  softenCloudParticle(random, target, thickDisc ? 0.5 : 0.34, 3, 0.68);
  if (thickDisc) {
    target.softness = Math.max(target.softness, 0.52);
  }
}

function assignMilkyWayParticleAppearance(
  random: () => number,
  target: MilkyWayParticle,
  brightProbability: number,
  minimumPointSize: number,
  maximumPointSize: number,
  alphaScale: number,
): void {
  if (random() < brightProbability) {
    const prominence = Math.pow(random(), 4.1);

    target.size = 0.82 + prominence * (maximumPointSize - 0.2);
    target.alpha = alphaScale * (0.58 + random() * 0.32 + prominence * 0.1);
    target.softness = 0.02 + random() * 0.11;

    return;
  }

  target.size = minimumPointSize + random() * (maximumPointSize - minimumPointSize);
  target.alpha = alphaScale * (0.22 + random() * 0.32);
  target.softness = 0.07 + random() * 0.18;
}

function softenCloudParticle(
  random: () => number,
  target: MilkyWayParticle,
  probability: number,
  sizeMultiplier: number,
  alphaMultiplier: number,
): void {
  if (random() >= probability) {
    return;
  }

  target.size *= sizeMultiplier * (0.76 + random() * 0.48);
  target.alpha *= alphaMultiplier * (0.72 + random() * 0.45);
  target.softness = Math.max(target.softness, 0.58 + random() * 0.32);
}

function centeredNoise(random: () => number): number {
  return random() + random() + random() - 1.5;
}

function fractionalPart(value: number): number {
  return value - Math.floor(value);
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
