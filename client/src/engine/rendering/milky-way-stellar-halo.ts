import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import {
  type MilkyWaySceneScale,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
} from '../coordinates/galaxy-scale-model';

const STELLAR_HALO_PARTICLE_COUNTS = {
  low: 12_000,
  medium: 26_000,
  high: 48_000,
} as const satisfies Record<GraphicQuality, number>;
const STELLAR_HALO_QUALITY_DENSITY_COMPENSATION = {
  low: 1.72,
  medium: 1.28,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;
const STELLAR_HALO_CLUSTER_COUNT = 48;
const STELLAR_HALO_CLUSTER_PARTICLE_PERIOD = 8;
const STELLAR_HALO_CLUSTER_PARTICLE_FRACTION = 1 / STELLAR_HALO_CLUSTER_PARTICLE_PERIOD;
const STELLAR_HALO_INNER_RADIUS = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER * 0.34;
const STELLAR_HALO_OUTER_RADIUS = MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER * 1.1;
const STELLAR_HALO_VERTICAL_FLATTENING = 0.78;
const STELLAR_HALO_MAXIMUM_OPACITY = 0.46;
const STELLAR_HALO_INNER_FADE_START = 1_200;
const STELLAR_HALO_INNER_FADE_END = 3_200;
const STELLAR_HALO_OUTER_FADE_START = 28_000;
const STELLAR_HALO_OUTER_FADE_END = 48_000;
const MINIMUM_VISIBLE_OPACITY = 0.004;
const STELLAR_HALO_BLUE = new THREE.Color(0x6f9cff);
const STELLAR_HALO_COOL_WHITE = new THREE.Color(0xb8dcff);
const STELLAR_HALO_IVORY = new THREE.Color(0xffddb0);
const STELLAR_HALO_AMBER = new THREE.Color(0xffa052);
const STELLAR_HALO_RED = new THREE.Color(0xff6558);

interface StellarHaloGeometryTemplate {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
  readonly clusterMembership: Float32Array;
}

interface StellarHaloCluster {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

let stellarHaloGeometryTemplate: StellarHaloGeometryTemplate | null = null;

/**
 * Illustrative visibility envelope for the sparse stellar halo. The inner fade keeps this wide
 * context out of Solar-System views, while the outer fade avoids leaking it into intergalactic
 * scales. It changes opacity only; all particles remain fixed in the galactocentric frame.
 */
export function calculateMilkyWayStellarHaloOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    return 0;
  }
  const innerPresence = smoothstep(
    STELLAR_HALO_INNER_FADE_START,
    STELLAR_HALO_INNER_FADE_END,
    cameraDistance,
  );
  const outerPresence =
    1 - smoothstep(STELLAR_HALO_OUTER_FADE_START, STELLAR_HALO_OUTER_FADE_END, cameraDistance);

  return STELLAR_HALO_MAXIMUM_OPACITY * innerPresence * outerPresence;
}

/**
 * One batched, deterministic point layer that extends the visual environment beyond the luminous
 * disc. It is deliberately not a diffuse glow: black remains visible between sparse stars and the
 * compact globular-like concentrations are visual cues rather than catalogued clusters.
 */
export class MilkyWayStellarHalo {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly geometry = createStellarHaloGeometry();
  private readonly material = createStellarHaloMaterial();
  private opacity = 0;

  constructor() {
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'illustrative-milky-way-stellar-halo';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.userData['scientificConfidence'] = 'illustrative';
    this.points.userData['visualRole'] = 'sparse-galactic-surroundings';
    this.points.userData['representationTechnique'] = 'single-batched-static-point-cloud';
    this.points.userData['distribution'] =
      'oblate-mixed-power-law-envelope-with-batched-globular-like-concentrations';
    this.points.userData['physicalInterpretation'] =
      'uncatalogued-stellar-halo-and-globular-cluster-visual-cues';
    this.points.userData['motionModel'] =
      'fixed-galactocentric-points-with-perspective-only-parallax';
    this.points.userData['diffuseEmission'] = 'none';
    this.points.userData['fogContribution'] = 'none';
    this.points.userData['colorTreatment'] =
      'old-ivory-amber-population-with-sparse-blue-and-red-stars';
    this.points.userData['clusterCount'] = STELLAR_HALO_CLUSTER_COUNT;
    this.points.userData['clusterParticleFraction'] = STELLAR_HALO_CLUSTER_PARTICLE_FRACTION;
    this.points.userData['authoringInnerRadius'] = STELLAR_HALO_INNER_RADIUS;
    this.points.userData['authoringOuterRadius'] = STELLAR_HALO_OUTER_RADIUS;
    this.points.userData['verticalFlattening'] = STELLAR_HALO_VERTICAL_FLATTENING;
    this.setQuality('medium');
  }

  public setQuality(quality: GraphicQuality): void {
    const densityCompensation = STELLAR_HALO_QUALITY_DENSITY_COMPENSATION[quality];

    this.geometry.setDrawRange(0, STELLAR_HALO_PARTICLE_COUNTS[quality]);
    this.material.uniforms['qualityDensityCompensation']!.value = densityCompensation;
    this.points.userData['quality'] = quality;
    this.points.userData['qualityDensityCompensation'] = densityCompensation;
  }

  public setPixelRatio(pixelRatio: number): void {
    this.material.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(pixelRatio, 0.5, 1.5);
  }

  public update(targetOpacity: number, deltaSeconds: number, sceneScale: MilkyWaySceneScale): void {
    if (deltaSeconds > 0) {
      this.opacity +=
        (THREE.MathUtils.clamp(targetOpacity, 0, 1) - this.opacity) *
        (1 - Math.exp(-6 * deltaSeconds));
    }
    this.material.uniforms['opacity']!.value = this.opacity;
    this.points.visible = this.opacity > MINIMUM_VISIBLE_OPACITY;
    this.points.scale.setScalar(sceneScale.modelScale);
    this.points.userData['opacity'] = this.opacity;
    this.points.userData['modelScale'] = sceneScale.modelScale;
    this.points.userData['worldOuterRadius'] = STELLAR_HALO_OUTER_RADIUS * sceneScale.modelScale;
    this.points.userData['referenceFrameBlend'] = sceneScale.referenceFrameBlend;
  }

  public dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

function createStellarHaloGeometry(): THREE.BufferGeometry {
  const template = getStellarHaloGeometryTemplate();
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(template.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(template.colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(template.sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(template.alphas, 1));
  geometry.setAttribute(
    'clusterMembership',
    new THREE.BufferAttribute(template.clusterMembership, 1),
  );

  return geometry;
}

function getStellarHaloGeometryTemplate(): StellarHaloGeometryTemplate {
  stellarHaloGeometryTemplate ??= createStellarHaloGeometryTemplate();

  return stellarHaloGeometryTemplate;
}

function createStellarHaloGeometryTemplate(): StellarHaloGeometryTemplate {
  const count = STELLAR_HALO_PARTICLE_COUNTS.high;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const clusterMembership = new Float32Array(count);
  const random = mulberry32(0x6a10_ba10);
  const clusters = createStellarHaloClusters(random);
  const color = new THREE.Color();
  const direction = new THREE.Vector3();

  for (let index = 0; index < count; index += 1) {
    const clusterMember = index % STELLAR_HALO_CLUSTER_PARTICLE_PERIOD === 0;
    const offset = index * 3;

    if (clusterMember) {
      const cluster =
        clusters[Math.floor(index / STELLAR_HALO_CLUSTER_PARTICLE_PERIOD) % clusters.length]!;
      const scatterRadius = Math.pow(random(), 1.8) * cluster.radius;

      sampleUnitDirection(random, direction);
      positions[offset] = cluster.x + direction.x * scatterRadius;
      positions[offset + 1] = cluster.y + direction.y * scatterRadius;
      positions[offset + 2] = cluster.z + direction.z * scatterRadius;
    } else {
      const radius = sampleIllustrativeHaloRadius(random);
      const triaxialStretch = 0.96 + random() * 0.1;

      sampleUnitDirection(random, direction);
      positions[offset] = direction.x * radius * triaxialStretch;
      positions[offset + 1] = direction.y * radius * STELLAR_HALO_VERTICAL_FLATTENING;
      positions[offset + 2] = direction.z * radius;
    }

    assignStellarHaloColor(random, color, clusterMember);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    const prominence = Math.pow(random(), clusterMember ? 3.8 : 5.2);

    sizes[index] = clusterMember ? 0.82 + prominence * 1.8 : 0.66 + prominence * 1.65;
    alphas[index] = clusterMember
      ? 0.22 + random() * 0.3 + prominence * 0.15
      : 0.16 + random() * 0.25 + prominence * 0.12;
    clusterMembership[index] = clusterMember ? 1 : 0;
  }

  return { positions, colors, sizes, alphas, clusterMembership };
}

function createStellarHaloClusters(random: () => number): readonly StellarHaloCluster[] {
  const direction = new THREE.Vector3();

  return Array.from({ length: STELLAR_HALO_CLUSTER_COUNT }, () => {
    const radius = THREE.MathUtils.lerp(
      STELLAR_HALO_INNER_RADIUS * 0.82,
      STELLAR_HALO_OUTER_RADIUS * 0.84,
      Math.pow(random(), 0.72),
    );

    sampleUnitDirection(random, direction);

    return {
      x: direction.x * radius,
      y: direction.y * radius * 0.84,
      z: direction.z * radius,
      radius: 34 + random() * 58,
    };
  });
}

function assignStellarHaloColor(
  random: () => number,
  target: THREE.Color,
  clusterMember: boolean,
): void {
  const temperature = clusterMember ? 0.24 + random() * 0.7 : random();

  if (temperature < 0.13) {
    target.lerpColors(STELLAR_HALO_BLUE, STELLAR_HALO_COOL_WHITE, temperature / 0.13);
  } else if (temperature < 0.38) {
    target.lerpColors(STELLAR_HALO_COOL_WHITE, STELLAR_HALO_IVORY, (temperature - 0.13) / 0.25);
  } else if (temperature < 0.78) {
    target.lerpColors(STELLAR_HALO_IVORY, STELLAR_HALO_AMBER, ((temperature - 0.38) / 0.4) * 0.72);
  } else {
    target.lerpColors(STELLAR_HALO_AMBER, STELLAR_HALO_RED, (temperature - 0.78) / 0.22);
  }
}

function sampleIllustrativeHaloRadius(random: () => number): number {
  if (random() < 0.36) {
    return THREE.MathUtils.lerp(
      STELLAR_HALO_OUTER_RADIUS * 0.72,
      STELLAR_HALO_OUTER_RADIUS,
      Math.pow(random(), 0.58),
    );
  }

  return (
    STELLAR_HALO_INNER_RADIUS *
    Math.pow(STELLAR_HALO_OUTER_RADIUS / STELLAR_HALO_INNER_RADIUS, random())
  );
}

function sampleUnitDirection(random: () => number, target: THREE.Vector3): void {
  const vertical = random() * 2 - 1;
  const azimuth = random() * Math.PI * 2;
  const planar = Math.sqrt(1 - vertical * vertical);

  target.set(Math.cos(azimuth) * planar, vertical, Math.sin(azimuth) * planar);
}

function createStellarHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      pixelRatio: { value: 1 },
      qualityDensityCompensation: {
        value: STELLAR_HALO_QUALITY_DENSITY_COMPENSATION.medium,
      },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float clusterMembership;
      uniform float pixelRatio;
      uniform float qualityDensityCompensation;
      varying vec3 starColor;
      varying float starAlpha;
      varying float clusterStrength;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float distanceToCamera = max(length(viewPosition.xyz), 1.0);
        float perspectiveGrowth = clamp(pow(4200.0 / distanceToCamera, 0.18), 0.82, 2.6);
        float qualityPointScale = sqrt(qualityDensityCompensation);
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

        starColor = max(vec3(0.0), mix(vec3(luminance), color, 1.12));
        starAlpha = pointAlpha * qualityDensityCompensation;
        clusterStrength = clusterMembership;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(
          pointSize * pixelRatio * perspectiveGrowth * qualityPointScale,
          0.72 * pixelRatio,
          mix(5.0, 8.0, clusterMembership) * pixelRatio
        );
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 starColor;
      varying float starAlpha;
      varying float clusterStrength;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float edge = 1.0 - smoothstep(0.78, 1.0, radius);
        float stellarCore = 1.0 - smoothstep(0.0, 0.18, radius);
        float compactHalo = exp(-radius * radius * mix(8.5, 6.2, clusterStrength)) * edge;
        float alpha = (compactHalo * mix(0.42, 0.5, clusterStrength) + stellarCore * 0.82)
          * starAlpha * opacity;
        vec3 color = starColor * (0.72 + stellarCore * 1.5 + clusterStrength * 0.1);

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

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
