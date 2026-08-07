import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { calculateMilkyWayTransition } from '../lod/milky-way-transition';
import { type PerformanceManager } from '../performance/performance-manager';
import {
  calculateGalactocentricSpiralAngle,
  MILKY_WAY_ARM_COUNT,
  MILKY_WAY_ARM_PITCH_DEGREES,
  MILKY_WAY_ARM_REFERENCE_RADIUS,
} from './milky-way-density-model';

export interface GalacticTransitionFrame {
  lodLevel: number;
  deltaSeconds: number;
  cameraDistance: number;
  starRadiance: number;
  galaxyRadiance: number;
  legacyMilkyWayVisible: boolean;
}

export class GalacticTransitionLayer {
  private readonly backdropGeometry = createBackdropGeometry(LOCAL_SKY_PARTICLE_COUNTS.high);
  private readonly backdropMaterial = createBackdropMaterial();
  private readonly milkyWayGeometry = createMilkyWayGeometry(MILKY_WAY_PARTICLE_COUNT);
  private readonly milkyWayMaterial = new THREE.PointsMaterial({
    size: 1.65,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
  private readonly backdrop = new THREE.Points(this.backdropGeometry, this.backdropMaterial);
  private readonly milkyWay = new THREE.Points(this.milkyWayGeometry, this.milkyWayMaterial);
  private milkyWayScale = 1;
  private stellarNeighborhoodScale = 1;

  constructor(
    private readonly spaceRoot: THREE.Group,
    private readonly stellarNeighborhoodRoot: THREE.Group,
    private readonly performanceManager: PerformanceManager,
  ) {
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS.medium);
    this.backdrop.name = 'distant-star-field';
    this.backdrop.userData['scientificConfidence'] = 'procedural';
    this.backdrop.userData['visualRole'] = 'decorative';
    this.backdrop.userData['visualStyle'] = 'integrated-galactic-sky-depth';
    this.backdrop.userData['distribution'] = 'isotropic-plus-galactic-plane';

    this.milkyWay.name = 'illustrative-milky-way';
    this.milkyWay.visible = false;
    this.milkyWay.userData['scientificConfidence'] = 'illustrative';
    this.milkyWay.userData['visualStructure'] = 'illustrative-galactocentric-four-arm-disk';
    this.milkyWay.userData['structureOrigin'] = 'galactic-center';
    this.milkyWay.userData['spiralArmCount'] = MILKY_WAY_ARM_COUNT;
    this.milkyWay.userData['spiralPitchDegrees'] = MILKY_WAY_ARM_PITCH_DEGREES;
    this.milkyWay.userData['visualRole'] = 'galactic-scale-transition';

    this.spaceRoot.add(this.backdrop, this.milkyWay);
  }

  public setQuality(quality: GraphicQuality): void {
    this.backdropGeometry.setDrawRange(0, LOCAL_SKY_PARTICLE_COUNTS[quality]);
    this.milkyWayGeometry.setDrawRange(
      0,
      Math.min(this.performanceManager.getParticleCount(quality), MILKY_WAY_PARTICLE_COUNT),
    );
  }

  public setPixelRatio(pixelRatio: number): void {
    this.backdropMaterial.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(
      pixelRatio,
      0.5,
      1.5,
    );
  }

  public update(frame: GalacticTransitionFrame): void {
    const transition = calculateMilkyWayTransition(frame.cameraDistance);
    const transitionVisible = frame.lodLevel === 3 || frame.lodLevel === 4;
    const targetOpacity =
      transitionVisible && frame.legacyMilkyWayVisible
        ? transition.detailOpacity * 0.03 * frame.galaxyRadiance
        : 0;
    const targetMilkyWayScale = transitionVisible ? transition.detailScale : 1;
    const targetStellarNeighborhoodScale = calculateStellarNeighborhoodScale(frame.cameraDistance);
    const targetBackdropOpacity = (BACKDROP_OPACITIES[frame.lodLevel] ?? 0) * frame.starRadiance;

    this.milkyWayMaterial.opacity = dampOpacity(
      this.milkyWayMaterial.opacity,
      targetOpacity,
      frame.deltaSeconds,
    );
    this.milkyWay.visible = this.milkyWayMaterial.opacity > MINIMUM_VISIBLE_OPACITY;
    this.milkyWayScale = dampOpacity(this.milkyWayScale, targetMilkyWayScale, frame.deltaSeconds);
    this.milkyWay.scale.setScalar(this.milkyWayScale);
    this.stellarNeighborhoodScale = dampOpacity(
      this.stellarNeighborhoodScale,
      targetStellarNeighborhoodScale,
      frame.deltaSeconds,
    );
    this.stellarNeighborhoodRoot.scale.setScalar(this.stellarNeighborhoodScale);
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
}

const LOCAL_SKY_PARTICLE_COUNTS = {
  low: 3_000,
  medium: 7_000,
  high: 14_000,
} as const satisfies Record<GraphicQuality, number>;
const MILKY_WAY_PARTICLE_COUNT = 10_000;
const BACKDROP_OPACITIES = [0.26, 0.34, 0.18, 0, 0, 0, 0] as const;
const STELLAR_NEIGHBORHOOD_SCALE_START = 1_400;
const STELLAR_NEIGHBORHOOD_SCALE_END = 9_600;
const GALACTIC_STELLAR_NEIGHBORHOOD_SCALE = 0.16;
const MINIMUM_VISIBLE_OPACITY = 0.004;

function dampOpacity(current: number, target: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-6 * deltaSeconds));
}

function calculateStellarNeighborhoodScale(cameraDistance: number): number {
  const progress = smoothstep(
    STELLAR_NEIGHBORHOOD_SCALE_START,
    STELLAR_NEIGHBORHOOD_SCALE_END,
    cameraDistance,
  );

  return 1 - progress * (1 - GALACTIC_STELLAR_NEIGHBORHOOD_SCALE);
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
  const cool = new THREE.Color(0x94b7ff);
  const neutral = new THREE.Color(0xe7efff);
  const warm = new THREE.Color(0xffbd72);
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
    if (temperature < 0.38) {
      color.lerpColors(cool, neutral, temperature / 0.38);
    } else {
      color.lerpColors(neutral, warm, (temperature - 0.38) / 0.62);
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
        float alpha = min(1.0, stellarHalo * 0.62 + stellarCore * 0.7)
          * starAlpha * opacity;
        vec3 color = starColor * (0.72 + stellarCore * 1.18);

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
  const random = mulberry32(0x51a7_f13d);
  const cool = new THREE.Color(0x7195d0);
  const warm = new THREE.Color(0xe1bc82);
  const sample: MilkyWayParticle = { x: 0, y: 0, z: 0, warmth: 0 };

  for (let index = 0; index < count; index += 1) {
    sampleMilkyWayParticle(random, sample);
    const offset = index * 3;

    positions[offset] = sample.x;
    positions[offset + 1] = sample.y;
    positions[offset + 2] = sample.z;
    colors[offset] = cool.r + (warm.r - cool.r) * sample.warmth;
    colors[offset + 1] = cool.g + (warm.g - cool.g) * sample.warmth;
    colors[offset + 2] = cool.b + (warm.b - cool.b) * sample.warmth;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

interface MilkyWayParticle {
  x: number;
  y: number;
  z: number;
  warmth: number;
}

function sampleMilkyWayParticle(random: () => number, target: MilkyWayParticle): void {
  const component = random();

  if (component < 0.17) {
    sampleGalacticBar(random, target);

    return;
  }
  if (component < 0.62) {
    sampleSpiralArm(random, target);

    return;
  }
  sampleDiffuseDisk(random, target);
}

function sampleGalacticBar(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 1.65);
  const angle = random() * Math.PI * 2;
  const barX = Math.cos(angle) * radialProgress * 1_420;
  const barZ = Math.sin(angle) * radialProgress * 520;
  const barRotation = Math.PI * 0.14;

  target.x = Math.cos(barRotation) * barX - Math.sin(barRotation) * barZ;
  target.y = centeredNoise(random) * 330 * (1 - radialProgress * 0.65);
  target.z = Math.sin(barRotation) * barX + Math.cos(barRotation) * barZ;
  target.warmth = 0.52 + (1 - radialProgress) * 0.28 + random() * 0.08;
}

function sampleSpiralArm(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.pow(random(), 0.78);
  const armIndex = Math.floor(random() * MILKY_WAY_ARM_COUNT);
  const armWidth = 75 + radialProgress * 185;
  const radius =
    MILKY_WAY_ARM_REFERENCE_RADIUS + radialProgress * 4_550 + centeredNoise(random) * armWidth;
  const angle =
    calculateGalactocentricSpiralAngle(radius, armIndex) +
    centeredNoise(random) * (0.08 + radialProgress * 0.075);

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (75 + radialProgress * 155);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.08 + (1 - radialProgress) * 0.18 + random() * 0.12;
}

function sampleDiffuseDisk(random: () => number, target: MilkyWayParticle): void {
  const radialProgress = Math.sqrt(random());
  const radius = 620 + radialProgress * 5_180;
  const angle = random() * Math.PI * 2;

  target.x = Math.cos(angle) * radius;
  target.y = centeredNoise(random) * (65 + radialProgress * 220);
  target.z = Math.sin(angle) * radius;
  target.warmth = 0.16 + (1 - radialProgress) * 0.3 + random() * 0.1;
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
