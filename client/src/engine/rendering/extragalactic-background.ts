import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';

const EXTRAGALACTIC_GALAXY_COUNTS = {
  low: 10_000,
  medium: 24_000,
  high: 52_000,
} as const satisfies Record<GraphicQuality, number>;
const EXTRAGALACTIC_QUALITY_SCALE = {
  low: 1.18,
  medium: 1.08,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;
const EXTRAGALACTIC_SHELL_RADIUS = 180_000;
const EXTRAGALACTIC_MAXIMUM_OPACITY = 0.62;
const EXTRAGALACTIC_INNER_FADE_START = 1_600;
const EXTRAGALACTIC_INNER_FADE_END = 3_200;
const EXTRAGALACTIC_OUTER_FADE_START = 45_000;
const EXTRAGALACTIC_OUTER_FADE_END = 75_000;
const MINIMUM_VISIBLE_OPACITY = 0.004;
const TWO_PI = Math.PI * 2;
const BLUE_STAR_FORMING_GALAXY = new THREE.Color(0x6f9fff);
const CYAN_STAR_FORMING_GALAXY = new THREE.Color(0x7bdfff);
const IVORY_STELLAR_POPULATION = new THREE.Color(0xffd7a2);
const AMBER_STELLAR_POPULATION = new THREE.Color(0xff8d4c);
const ROSE_STELLAR_POPULATION = new THREE.Color(0xff6f91);

interface ExtragalacticGeometryTemplate {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
  readonly angles: Float32Array;
  readonly axisRatios: Float32Array;
  readonly profiles: Float32Array;
  readonly prominences: Float32Array;
  readonly seeds: Float32Array;
  readonly transmissions: Float32Array;
}

interface ExtragalacticAppearance {
  readonly prominence: number;
  readonly profile: number;
  readonly seed: number;
}

let extragalacticGeometryTemplate: ExtragalacticGeometryTemplate | null = null;

/**
 * Illustrative exposure envelope for a representative extragalactic sky sample. It is absent from
 * close Solar-System views and yields to the catalogue-backed cosmic map at larger scales.
 */
export function calculateExtragalacticBackgroundOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    return 0;
  }
  const innerPresence = smoothstep(
    EXTRAGALACTIC_INNER_FADE_START,
    EXTRAGALACTIC_INNER_FADE_END,
    cameraDistance,
  );
  const outerPresence =
    1 - smoothstep(EXTRAGALACTIC_OUTER_FADE_START, EXTRAGALACTIC_OUTER_FADE_END, cameraDistance);

  return EXTRAGALACTIC_MAXIMUM_OPACITY * innerPresence * outerPresence;
}

/**
 * A camera-centred, non-interactive sample of the much larger cosmological galaxy population. The
 * positions and appearances are procedural visual context, not a catalogue or a one-to-one model
 * of observable galaxies. One point batch supplies extended impostors without per-galaxy objects.
 */
export class ExtragalacticBackground {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly geometry = createExtragalacticGeometry();
  private readonly material = createExtragalacticMaterial();
  private opacity = 0;

  constructor() {
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'illustrative-extragalactic-background';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 0;
    this.points.userData['scientificConfidence'] = 'illustrative';
    this.points.userData['catalogAssociation'] = 'none';
    this.points.userData['sceneRole'] = 'non-interactive-distant-galaxy-background';
    this.points.userData['observerAnchoring'] = 'camera-centered-celestial-shell';
    this.points.userData['motionModel'] = 'fixed-sky-directions-without-translational-parallax';
    this.points.userData['populationTreatment'] =
      'representative-sample-of-the-cosmological-galaxy-population-not-a-literal-count';
    this.points.userData['visualStyle'] =
      'extended-elliptical-spiral-and-irregular-low-surface-brightness-impostors';
    this.points.userData['galacticOcclusion'] =
      'illustrative-zone-of-avoidance-from-galactic-latitude';
    this.points.userData['shellRadius'] = EXTRAGALACTIC_SHELL_RADIUS;
    this.setQuality('medium');
  }

  public setQuality(quality: GraphicQuality): void {
    const qualityScale = EXTRAGALACTIC_QUALITY_SCALE[quality];

    this.geometry.setDrawRange(0, EXTRAGALACTIC_GALAXY_COUNTS[quality]);
    this.material.uniforms['qualityScale']!.value = qualityScale;
    this.points.userData['quality'] = quality;
    this.points.userData['qualityScale'] = qualityScale;
  }

  public setPixelRatio(pixelRatio: number): void {
    this.material.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(pixelRatio, 0.5, 1.5);
  }

  public setObserverPosition(position: THREE.Vector3): void {
    this.points.position.copy(position);
  }

  public update(targetOpacity: number, deltaSeconds: number, radiance: number): void {
    if (deltaSeconds > 0) {
      this.opacity +=
        (THREE.MathUtils.clamp(targetOpacity, 0, 1) - this.opacity) *
        (1 - Math.exp(-5 * deltaSeconds));
    }
    this.material.uniforms['opacity']!.value = this.opacity;
    this.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    this.points.visible = this.opacity > MINIMUM_VISIBLE_OPACITY;
    this.points.userData['opacity'] = this.opacity;
  }

  public dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createExtragalacticGeometry(): THREE.BufferGeometry {
  const template = getExtragalacticGeometryTemplate();
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(template.positions, 3));
  geometry.setAttribute('galaxyColor', new THREE.BufferAttribute(template.colors, 3));
  geometry.setAttribute('galaxySize', new THREE.BufferAttribute(template.sizes, 1));
  geometry.setAttribute('galaxyAlpha', new THREE.BufferAttribute(template.alphas, 1));
  geometry.setAttribute('galaxyAngle', new THREE.BufferAttribute(template.angles, 1));
  geometry.setAttribute('galaxyAxisRatio', new THREE.BufferAttribute(template.axisRatios, 1));
  geometry.setAttribute('galaxyProfile', new THREE.BufferAttribute(template.profiles, 1));
  geometry.setAttribute('galaxyProminence', new THREE.BufferAttribute(template.prominences, 1));
  geometry.setAttribute('galaxySeed', new THREE.BufferAttribute(template.seeds, 1));
  geometry.setAttribute(
    'galacticTransmission',
    new THREE.BufferAttribute(template.transmissions, 1),
  );

  return geometry;
}

function getExtragalacticGeometryTemplate(): ExtragalacticGeometryTemplate {
  extragalacticGeometryTemplate ??= createExtragalacticGeometryTemplate();

  return extragalacticGeometryTemplate;
}

function createExtragalacticGeometryTemplate(): ExtragalacticGeometryTemplate {
  const count = EXTRAGALACTIC_GALAXY_COUNTS.high;
  const template = allocateExtragalacticGeometryTemplate(count);
  const random = mulberry32(0xe77a_6a1a);
  const direction = new THREE.Vector3();
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const appearance = sampleExtragalacticAppearance(random);
    const offset = index * 3;

    sampleUnitDirection(random, direction);
    direction.multiplyScalar(EXTRAGALACTIC_SHELL_RADIUS);
    direction.toArray(template.positions, offset);
    assignExtragalacticColor(appearance.profile, appearance.seed, color);
    color.toArray(template.colors, offset);
    assignExtragalacticGeometryEntry(template, index, direction, appearance, random);
  }

  return template;
}

function allocateExtragalacticGeometryTemplate(count: number): ExtragalacticGeometryTemplate {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    alphas: new Float32Array(count),
    angles: new Float32Array(count),
    axisRatios: new Float32Array(count),
    profiles: new Float32Array(count),
    prominences: new Float32Array(count),
    seeds: new Float32Array(count),
    transmissions: new Float32Array(count),
  };
}

function sampleExtragalacticAppearance(random: () => number): ExtragalacticAppearance {
  return {
    prominence: Math.pow(random(), 7.5),
    profile: random(),
    seed: random(),
  };
}

function assignExtragalacticGeometryEntry(
  template: ExtragalacticGeometryTemplate,
  index: number,
  direction: THREE.Vector3,
  appearance: ExtragalacticAppearance,
  random: () => number,
): void {
  const latitude = Math.abs(direction.y) / EXTRAGALACTIC_SHELL_RADIUS;
  const zoneOfAvoidance = smoothstep(0.025, 0.2, latitude);

  template.sizes[index] = 2.35 + random() * 1.65 + appearance.prominence * 10.5;
  template.alphas[index] = 0.14 + random() * 0.24 + appearance.prominence * 0.42;
  template.angles[index] = random() * TWO_PI;
  template.axisRatios[index] = 0.24 + Math.pow(random(), 0.72) * 0.7;
  template.profiles[index] = appearance.profile;
  template.prominences[index] = appearance.prominence;
  template.seeds[index] = appearance.seed;
  template.transmissions[index] = THREE.MathUtils.lerp(0.1, 1, zoneOfAvoidance);
}

function assignExtragalacticColor(profile: number, seed: number, target: THREE.Color): void {
  if (profile < 0.3) {
    target.lerpColors(IVORY_STELLAR_POPULATION, AMBER_STELLAR_POPULATION, seed * 0.74);
  } else if (profile < 0.78) {
    target.lerpColors(BLUE_STAR_FORMING_GALAXY, IVORY_STELLAR_POPULATION, seed * 0.68);
  } else if (seed < 0.56) {
    target.lerpColors(CYAN_STAR_FORMING_GALAXY, BLUE_STAR_FORMING_GALAXY, seed / 0.56);
  } else {
    target.lerpColors(IVORY_STELLAR_POPULATION, ROSE_STELLAR_POPULATION, (seed - 0.56) / 0.44);
  }
}

function sampleUnitDirection(random: () => number, target: THREE.Vector3): void {
  const vertical = random() * 2 - 1;
  const azimuth = random() * TWO_PI;
  const planar = Math.sqrt(1 - vertical * vertical);

  target.set(Math.cos(azimuth) * planar, vertical, Math.sin(azimuth) * planar);
}

function createExtragalacticMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      pixelRatio: { value: 1 },
      qualityScale: { value: EXTRAGALACTIC_QUALITY_SCALE.medium },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute vec3 galaxyColor;
      attribute float galaxySize;
      attribute float galaxyAlpha;
      attribute float galaxyAngle;
      attribute float galaxyAxisRatio;
      attribute float galaxyProfile;
      attribute float galaxyProminence;
      attribute float galaxySeed;
      attribute float galacticTransmission;
      uniform float pixelRatio;
      uniform float qualityScale;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vOrientation;
      varying float vAxisRatio;
      varying float vProfile;
      varying float vProminence;
      varying float vSeed;

      void main() {
        vColor = galaxyColor;
        vAlpha = galaxyAlpha * galacticTransmission;
        vOrientation = vec2(cos(galaxyAngle), sin(galaxyAngle));
        vAxisRatio = galaxyAxisRatio;
        vProfile = galaxyProfile;
        vProminence = galaxyProminence;
        vSeed = galaxySeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = galaxySize * pixelRatio * qualityScale;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vOrientation;
      varying float vAxisRatio;
      varying float vProfile;
      varying float vProminence;
      varying float vSeed;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        vec2 orientedPoint = mat2(
          vOrientation.x,
          -vOrientation.y,
          vOrientation.y,
          vOrientation.x
        ) * point;
        float radius = length(vec2(orientedPoint.x, orientedPoint.y / vAxisRatio));
        if (radius > 1.0) {
          discard;
        }

        float softEdge = 1.0 - smoothstep(0.68, 1.0, radius);
        float polarAngle = atan(orientedPoint.y, orientedPoint.x);
        float spiralPattern = 0.5 + 0.5 * cos(
          polarAngle * 2.0 - radius * mix(7.0, 12.0, vSeed) + vSeed * 6.2831853
        );
        float spiralArms = smoothstep(0.54, 0.9, spiralPattern);
        float diskLight = exp(-3.25 * radius) * (0.5 + spiralArms * 0.72);
        float ellipticalLight = exp(-2.3 * pow(max(radius, 0.0001), 0.72));
        vec2 irregularOffset = vec2(0.24 + vSeed * 0.12, -0.1);
        float irregularLobe = exp(-11.0 * length(orientedPoint - irregularOffset));
        float diskMix = smoothstep(0.3, 0.48, vProfile) *
          (1.0 - smoothstep(0.76, 0.88, vProfile));
        float irregularMix = smoothstep(0.76, 0.92, vProfile);
        float bodyLight = mix(ellipticalLight, diskLight, diskMix);
        bodyLight = mix(bodyLight, diskLight * 0.74 + irregularLobe * 0.42, irregularMix);
        float luminousCore = exp(-11.5 * radius) * (0.56 + vProminence * 0.72);
        float dustLane = mix(
          1.0,
          0.68 + 0.32 * smoothstep(0.035, 0.16, abs(orientedPoint.y)),
          diskMix * smoothstep(0.22, 0.7, radius)
        );
        float light = softEdge * (bodyLight * dustLane * 0.78 + luminousCore * 0.94);
        if (light < 0.012) {
          discard;
        }
        vec3 coreColor = vec3(1.0, 0.91, 0.76);
        vec3 color = mix(vColor, coreColor, luminousCore * 0.48);
        float alpha = opacity * vAlpha * light;

        gl_FragColor = vec4(color * radiance * (0.74 + light * 0.5), alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}

function mulberry32(seed: number): () => number {
  let value = seed;

  return () => {
    value |= 0;
    value = (value + 0x6d2b_79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);

    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;

    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}
