import * as THREE from 'three';
import type {
  GalaxyVisualShape,
  GraphicQuality,
  SpaceObject,
} from '../../data/models/universe.models';
import { getGalaxyRenderScale } from '../coordinates/galaxy-scale-model';
import type { ContinuousCelestialVolume } from './celestial-visual-types';

const MINIMUM_PARTICLES = 1_024;
const PARTICLE_BUDGETS = {
  low: 16_384,
  medium: 65_536,
  high: 131_072,
} as const satisfies Record<GraphicQuality, number>;

export interface GalaxyVolumeVisual extends ContinuousCelestialVolume {
  root: THREE.Group;
  materials: readonly THREE.Material[];
}

export function getGalaxyParticleBudget(quality: GraphicQuality): number {
  return PARTICLE_BUDGETS[quality];
}

export function createGalaxyVolumeVisual(
  object: SpaceObject,
  quality: GraphicQuality,
): GalaxyVolumeVisual {
  const scaleModel = getGalaxyRenderScale(object);
  const shape = object.visual.galaxyShape ?? 'elliptical';
  const seed = hashString(object.id);
  const coolColor = new THREE.Color('#c4d5ec').lerp(
    new THREE.Color(object.visual.color ?? '#b7c9e5'),
    0.18,
  );
  const warmColor = new THREE.Color('#f7d6a0').lerp(
    new THREE.Color(object.visual.secondaryColor ?? '#e2c391'),
    0.22,
  );
  const root = new THREE.Group();
  const material = createGalaxyGrainMaterial();
  const createGeometry = (count: number): THREE.BufferGeometry =>
    createGalaxyGrainGeometry(shape, count, seed, coolColor, warmColor);
  const grains = new THREE.Points(createGeometry(MINIMUM_PARTICLES), material);
  const viewport = new THREE.Vector4();
  let activeCount = MINIMUM_PARTICLES;

  root.name = `${object.id}-galaxy-near-volume`;
  root.scale.setScalar(scaleModel.renderDiameter / 2);
  root.userData['renderDiameter'] = scaleModel.renderDiameter;
  root.userData['diameterTreatment'] = scaleModel.diameterTreatment;
  root.rotation.order = 'ZXY';
  root.rotation.x = Math.acos(
    THREE.MathUtils.clamp(object.visual.galaxyAxisRatio ?? 0.72, 0.16, 1),
  );
  root.rotation.z = THREE.MathUtils.degToRad(object.visual.galaxyRotationDegrees ?? 0);
  grains.name = `${object.id}-galaxy-stellar-volume`;
  grains.userData['scientificConfidence'] = 'illustrative';
  grains.userData['appearanceConfidence'] = 'illustrative';
  grains.userData['visualStyle'] = 'continuous-galaxy-grain-volume';
  grains.userData['morphology'] = shape;
  grains.userData['sourceTreatment'] = 'seeded-density-samples-not-individual-observed-stars';
  grains.renderOrder = 4;
  grains.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(viewport);
    material.uniforms['viewportHeight']!.value = viewport.w;
    material.uniforms['pixelRatio']!.value = Math.min(renderer.getPixelRatio(), 2);
  };
  root.add(grains);

  return {
    root,
    materials: [material],
    updateDetail(apparentRadiusPixels, displayedLocalRadius, deltaSeconds) {
      const targetCount = THREE.MathUtils.clamp(
        apparentRadiusPixels * apparentRadiusPixels * 4,
        MINIMUM_PARTICLES,
        getGalaxyParticleBudget(quality),
      );

      activeCount = THREE.MathUtils.lerp(
        activeCount,
        targetCount,
        1 - Math.exp(-4 * Math.max(0, deltaSeconds)),
      );
      const drawCount = Math.ceil(activeCount);
      const capacity = Math.min(
        getGalaxyParticleBudget(quality),
        2 ** Math.ceil(Math.log2(drawCount)),
      );

      // Reallocate before rendering, never from onBeforeRender: the renderer may already
      // have captured the previous geometry there. Stable prefixes preserve every old grain.
      if (
        capacity > grains.geometry.getAttribute('position').count ||
        capacity * 4 < grains.geometry.getAttribute('position').count
      ) {
        const previous = grains.geometry;

        grains.geometry = createGeometry(capacity);
        previous.dispose();
      }
      grains.geometry.setDrawRange(0, drawCount);
      material.uniforms['activeCount']!.value = activeCount;
      root.scale.setScalar(displayedLocalRadius);
    },
  };
}

function createGalaxyGrainGeometry(
  shape: GalaxyVisualShape,
  count: number,
  seed: number,
  coolColor: THREE.Color,
  warmColor: THREE.Color,
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const indices = new Float32Array(count);
  const random = mulberry32(seed);
  const arms = 2 + (seed % 2) * 2;
  const phase = (seed / 4_294_967_296) * Math.PI * 2;
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const point =
      shape === 'spiral'
        ? random() < 0.24
          ? createEllipticalPoint(random).multiplyScalar(0.28)
          : createSpiralPoint(arms, phase, random)
        : shape === 'elliptical'
          ? createEllipticalPoint(random)
          : createIrregularPoint(phase, random);
    const radius = point.length();
    const warmth =
      shape === 'elliptical'
        ? 0.68 + random() * 0.28
        : shape === 'irregular'
          ? random() * 0.3
          : 1 - THREE.MathUtils.smoothstep(radius, 0.04, 0.48);

    color
      .copy(coolColor)
      .lerp(warmColor, warmth)
      .multiplyScalar(0.82 + random() * 0.28);
    point.toArray(positions, index * 3);
    color.toArray(colors, index * 3);
    sizes[index] = 0.006 + Math.pow(random(), 3) * 0.01;
    alphas[index] = (0.36 + random() * 0.34) * (1 - THREE.MathUtils.smoothstep(radius, 0.75, 1));
    indices[index] = index;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('sampleIndex', new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, count);
  geometry.computeBoundingSphere();

  return geometry;
}

function createSpiralPoint(arms: number, phase: number, random: () => number): THREE.Vector3 {
  const radius = 0.02 + Math.pow(random(), 0.82) * 0.98;
  const arm = Math.floor(random() * arms);
  const interArm = random() < 0.42;
  const angle =
    phase +
    (arm / arms) * Math.PI * 2 +
    Math.log(radius + 0.16) * 3.1 +
    Math.sin(radius * 23 + phase) * 0.075 +
    (random() + random() - 1) * (interArm ? 3.8 : 0.36 + radius * 0.58);
  const thickness = (random() + random() - 1) * (0.018 + (1 - radius) * 0.035);

  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, thickness);
}

function createEllipticalPoint(random: () => number): THREE.Vector3 {
  const radius = Math.pow(random(), 0.92);
  const longitude = random() * Math.PI * 2;
  const latitudeSine = random() * 2 - 1;
  const latitudeRadius = Math.sqrt(1 - latitudeSine * latitudeSine);

  return new THREE.Vector3(
    Math.cos(longitude) * latitudeRadius * radius,
    Math.sin(longitude) * latitudeRadius * radius,
    latitudeSine * radius * 0.68,
  );
}

function createIrregularPoint(phase: number, random: () => number): THREE.Vector3 {
  const clusterAngle = phase + Math.floor(random() * 5) * 2.399_963;
  const spread = 0.18 + random() * 0.35;

  return new THREE.Vector3(
    Math.cos(clusterAngle) * 0.42 + (random() + random() - 1) * spread,
    Math.sin(clusterAngle) * 0.31 + (random() + random() - 1) * spread,
    Math.sin(clusterAngle * 2) * 0.08 + (random() + random() - 1) * spread * 0.45,
  );
}

function createGalaxyGrainMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      viewportHeight: { value: 1 },
      activeCount: { value: MINIMUM_PARTICLES },
      layerOpacity: { value: 0.82 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float sampleIndex;
      uniform float pixelRatio;
      uniform float viewportHeight;
      uniform float activeCount;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float worldScale = length(modelMatrix[0].xyz);
        float focalPixels = viewportHeight * projectionMatrix[1][1] * 0.5;
        float rasterDiameter = 3.8 * pixelRatio;
        float projectedDiameter = pointSize * worldScale * focalPixels / max(-viewPosition.z, 0.001);
        float coverage = min(1.0, pow(projectedDiameter / rasterDiameter, 2.0));
        float sampleWeight = 1.0 - smoothstep(activeCount * 0.82, activeCount, sampleIndex);
        float densityCompensation = 65536.0 / (activeCount * 0.91);
        // Euclidean proximity, not camera depth: rotating cannot erase a hemisphere.
        float passageOpacity = smoothstep(0.003, 0.035, length(viewPosition.xyz) / worldScale);
        vColor = color;
        vAlpha = pointAlpha * coverage * sampleWeight * densityCompensation * passageOpacity;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = rasterDiameter;
      }
    `,
    fragmentShader: `
      uniform float layerOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radiusSquared = dot(point, point);
        if (radiusSquared > 1.0) {
          discard;
        }
        float grain = exp(-radiusSquared * 5.0) * (1.0 - smoothstep(0.64, 1.0, radiusSquared));
        gl_FragColor = vec4(vColor, min(0.92, grain * vAlpha * layerOpacity));
      }
    `,
    transparent: true,
    opacity: 0.82,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  material.userData['visualStyle'] = 'continuous-galaxy-grain-volume';

  return material;
}

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b_79f5;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
