import * as THREE from 'three';
import { GalaxyVisualShape, GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';

const PARTICLE_BUDGETS = {
  low: 360,
  medium: 900,
  high: 2_200,
} as const satisfies Record<GraphicQuality, number>;

const MORPHOLOGY_INDEX = {
  spiral: 0,
  elliptical: 1,
  irregular: 2,
} as const satisfies Record<GalaxyVisualShape, number>;

export interface GalaxyVolumeVisual {
  root: THREE.Group;
  materials: readonly THREE.Material[];
  pickables: readonly THREE.Object3D[];
}

export function getGalaxyParticleBudget(quality: GraphicQuality): number {
  return PARTICLE_BUDGETS[quality];
}

export function createGalaxyVolumeVisual(
  object: SpaceObject,
  quality: GraphicQuality,
): GalaxyVolumeVisual {
  const shape = object.visual.galaxyShape ?? 'elliptical';
  const axisRatio = THREE.MathUtils.clamp(object.visual.galaxyAxisRatio ?? 0.72, 0.16, 1);
  const rotation = THREE.MathUtils.degToRad(object.visual.galaxyRotationDegrees ?? 0);
  const primaryColor = new THREE.Color(object.visual.color ?? '#b7c9e5');
  const secondaryColor = new THREE.Color(object.visual.secondaryColor ?? '#e2c391');
  const seed = hashString(object.id) / 4_294_967_296;
  const root = new THREE.Group();

  root.name = `${object.id}-galaxy-near-volume`;
  root.scale.setScalar(object.visual.visualRadius);
  root.rotation.order = 'ZXY';
  root.rotation.x = Math.acos(axisRatio);
  root.rotation.z = rotation;

  const diskMaterial = createGalaxyDiskMaterial(shape, primaryColor, secondaryColor, seed);
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 2.08), diskMaterial);

  disk.name = `${object.id}-galaxy-structured-disk`;
  disk.layers.enable(PICKING_LAYER);
  disk.userData['objectId'] = object.id;
  disk.userData['scientificConfidence'] = object.scientificConfidence;
  disk.userData['appearanceConfidence'] = 'illustrative';
  disk.userData['visualStyle'] = 'procedural-structured-galaxy-disk';
  disk.renderOrder = 3;
  root.add(disk);

  const starMaterial = createGalaxyStarMaterial();
  const stars = new THREE.Points(
    createGalaxyStarGeometry(
      shape,
      getGalaxyParticleBudget(quality),
      seed,
      primaryColor,
      secondaryColor,
    ),
    starMaterial,
  );

  stars.name = `${object.id}-galaxy-stellar-volume`;
  stars.userData['scientificConfidence'] = object.scientificConfidence;
  stars.userData['appearanceConfidence'] = 'illustrative';
  stars.userData['visualStyle'] = 'volumetric-galaxy-star-field';
  stars.renderOrder = 4;
  root.add(stars);

  return {
    root,
    materials: [diskMaterial, starMaterial],
    pickables: [disk],
  };
}

function createGalaxyDiskMaterial(
  shape: GalaxyVisualShape,
  primaryColor: THREE.Color,
  secondaryColor: THREE.Color,
  seed: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      primaryColor: { value: primaryColor },
      secondaryColor: { value: secondaryColor },
      morphology: { value: MORPHOLOGY_INDEX[shape] },
      seed: { value: seed },
      layerOpacity: { value: 0.84 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vInteriorFade;

      void main() {
        vUv = uv;
        float volumeRadius = length(modelViewMatrix[0].xyz);
        float centerDistance = length((modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
        vInteriorFade = smoothstep(volumeRadius * 0.28, volumeRadius * 0.82, centerDistance);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 primaryColor;
      uniform vec3 secondaryColor;
      uniform float morphology;
      uniform float seed;
      uniform float layerOpacity;
      varying vec2 vUv;
      varying float vInteriorFade;

      float galaxyHash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7)) + seed * 91.7) * 43758.5453);
      }

      float galaxyNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(galaxyHash(cell), galaxyHash(cell + vec2(1.0, 0.0)), local.x),
          mix(
            galaxyHash(cell + vec2(0.0, 1.0)),
            galaxyHash(cell + vec2(1.0, 1.0)),
            local.x
          ),
          local.y
        );
      }

      float galaxyFbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 4; octave += 1) {
          value += galaxyNoise(point) * amplitude;
          point = mat2(1.6, -1.2, 1.2, 1.6) * point + 3.17;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 point = (vUv - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }

        float angle = atan(point.y, point.x);
        float fineStructure = galaxyFbm(point * 18.0 + seed * 7.0);
        float broadStructure = galaxyFbm(point * 4.2 - seed * 5.0);
        float spiralWave = 0.5 + 0.5 * cos(
          angle * 2.0 - radius * 13.5 + broadStructure * 1.2 + seed * 6.2831853
        );
        float spiralDensity = pow(spiralWave, 3.4);
        float dustWave = 0.5 + 0.5 * cos(
          angle * 2.0 - radius * 13.5 + 0.55 + seed * 6.2831853
        );
        float dustLane = 1.0 - smoothstep(0.58, 0.86, dustWave) *
          smoothstep(0.18, 0.48, radius) * 0.72;
        float exponentialDisk = exp(-2.85 * radius);
        float spiralBody = exponentialDisk *
          (0.28 + spiralDensity * 1.08 + fineStructure * 0.22) * dustLane;
        float ellipticalBody = exp(-2.7 * pow(max(radius, 0.0001), 0.62)) *
          (0.8 + fineStructure * 0.14);
        float irregularBody = smoothstep(
          0.74,
          0.28,
          radius + (broadStructure - 0.5) * 0.62
        ) * (0.48 + fineStructure * 0.72);
        float body = morphology < 0.5
          ? spiralBody
          : morphology < 1.5
            ? ellipticalBody
            : irregularBody;
        float core = exp(-15.0 * radius) * (morphology > 1.5 ? 0.35 : 1.0);
        float starKnots = pow(max(fineStructure - 0.56, 0.0), 2.0) *
          smoothstep(0.9, 0.2, radius);
        float edge = 1.0 - smoothstep(0.76, 1.0, radius);
        float alpha = (body * 0.86 + core * 0.94 + starKnots * 0.46) * edge *
          vInteriorFade;

        if (alpha < 0.012) {
          discard;
        }

        vec3 coolDisk = mix(primaryColor, vec3(0.58, 0.76, 1.0), 0.32);
        vec3 warmCore = mix(secondaryColor, vec3(1.0, 0.88, 0.66), 0.46);
        vec3 color = mix(coolDisk, warmCore, clamp(core * 1.4 + starKnots * 0.4, 0.0, 1.0));
        color *= 0.72 + body * 0.58 + core * 0.72;
        gl_FragColor = vec4(color, clamp(alpha * layerOpacity, 0.0, 0.96));
      }
    `,
    transparent: true,
    opacity: 0.84,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  material.userData['visualStyle'] = 'procedural-structured-galaxy-disk';

  return material;
}

function createGalaxyStarGeometry(
  shape: GalaxyVisualShape,
  count: number,
  seed: number,
  primaryColor: THREE.Color,
  secondaryColor: THREE.Color,
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = mulberry32(Math.floor(seed * 4_294_967_295));
  const armCount = 2 + (Math.floor(seed * 97) % 3);

  for (let index = 0; index < count; index += 1) {
    const point =
      shape === 'spiral'
        ? random() < 0.18
          ? createEllipticalPoint(random).multiplyScalar(0.46)
          : createSpiralPoint(index, armCount, random)
        : shape === 'elliptical'
          ? createEllipticalPoint(random)
          : createIrregularPoint(random);
    const offset = index * 3;
    const radius = Math.hypot(point.x, point.y, point.z);
    const color = primaryColor
      .clone()
      .lerp(secondaryColor, Math.max(0, 1 - radius) * 0.58)
      .lerp(new THREE.Color(0xffffff), random() * 0.22);

    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 0.82 + random() * 1.68 + Math.max(0, 0.35 - radius) * 1.45;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();

  return geometry;
}

function createSpiralPoint(index: number, armCount: number, random: () => number): THREE.Vector3 {
  const radius = Math.pow(random(), 0.58);
  const arm = index % armCount;
  const angle =
    (arm / armCount) * Math.PI * 2 +
    radius * Math.PI * 3.9 +
    (random() - 0.5) * (0.22 + radius * 0.58);
  const thickness = (random() + random() - 1) * (0.055 + (1 - radius) * 0.045);

  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, thickness);
}

function createEllipticalPoint(random: () => number): THREE.Vector3 {
  const radius = Math.pow(random(), 0.62);
  const longitude = random() * Math.PI * 2;
  const latitudeSine = random() * 2 - 1;
  const latitudeRadius = Math.sqrt(Math.max(0, 1 - latitudeSine * latitudeSine));

  return new THREE.Vector3(
    Math.cos(longitude) * latitudeRadius * radius,
    Math.sin(longitude) * latitudeRadius * radius,
    latitudeSine * radius * 0.68,
  );
}

function createIrregularPoint(random: () => number): THREE.Vector3 {
  const cluster = Math.floor(random() * 4);
  const centers = [
    [-0.36, -0.1, 0.04],
    [0.22, -0.28, -0.03],
    [0.34, 0.31, 0.02],
    [-0.08, 0.35, -0.02],
  ] as const;
  const center = centers[cluster]!;
  const spread = 0.2 + random() * 0.22;

  return new THREE.Vector3(
    center[0] + (random() + random() - 1) * spread,
    center[1] + (random() + random() - 1) * spread,
    center[2] + (random() + random() - 1) * spread * 0.38,
  );
}

function createGalaxyStarMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      layerOpacity: { value: 0.82 },
    },
    vertexShader: `
      attribute float pointSize;
      uniform float pixelRatio;
      varying vec3 vColor;

      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float layerOpacity;
      varying vec3 vColor;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float stellarCore = 1.0 - smoothstep(0.0, 0.24, radius);
        float stellarHalo = pow(max(0.0, 1.0 - radius), 2.1);
        float alpha = (stellarHalo * 0.42 + stellarCore * 0.68) * layerOpacity;
        gl_FragColor = vec4(vColor * (0.68 + stellarCore * 0.82), alpha);
      }
    `,
    transparent: true,
    opacity: 0.82,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  material.userData['visualStyle'] = 'volumetric-galaxy-star-field';

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
