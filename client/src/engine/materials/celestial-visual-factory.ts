import * as THREE from 'three';
import { GalaxyVisualShape, GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { LunarEclipseVisual } from './lunar-eclipse-visual';
import { SolarEclipseVisual } from './solar-eclipse-visual';

export interface ManagedLodMaterial {
  material: THREE.Material;
  baseOpacity: number;
  baseDepthWrite: boolean;
}

export interface CelestialLodRepresentation {
  nearRoot: THREE.Group | null;
  farSprite: THREE.Sprite | null;
  nearMaterials: ManagedLodMaterial[];
  nearBlend: number;
  visibilityBlend: number;
  farAlpha: number;
  farBaseOpacity: number;
  farBaseDiameter: number;
  farAspectRatio: number;
}

export interface CelestialVisual {
  root: THREE.Group;
  rotatingBody: THREE.Object3D | null;
  lunarEclipse: LunarEclipseVisual | null;
  solarEclipse: SolarEclipseVisual | null;
  observerCorona: THREE.Sprite | null;
  pickables: THREE.Object3D[];
  lod: CelestialLodRepresentation;
}

export interface CelestialVisualAssets {
  glowTexture: THREE.Texture;
  galaxyTextures: Readonly<Record<GalaxyVisualShape, THREE.Texture>>;
  sphereGeometry: THREE.SphereGeometry;
  selectionGeometry: THREE.SphereGeometry;
  ringGeometry: THREE.RingGeometry;
  selectionMaterial: THREE.MeshBasicMaterial;
}

export function createCelestialVisualAssets(quality: GraphicQuality): CelestialVisualAssets {
  const segments = quality === 'low' ? 24 : quality === 'medium' ? 48 : 72;

  return {
    glowTexture: createSharedGlowTexture(),
    galaxyTextures: createGalaxyTextures(),
    sphereGeometry: new THREE.SphereGeometry(1, segments, Math.max(12, segments / 2)),
    selectionGeometry: new THREE.SphereGeometry(1, 10, 8),
    ringGeometry: new THREE.RingGeometry(1.35, 2.25, segments * 2),
    selectionMaterial: new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    }),
  };
}

export function createCelestialVisual(
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
  const root = new THREE.Group();

  root.name = `${object.id}-visual`;

  if (object.type === 'region') {
    return createInvisibleVisual(root);
  }

  if (object.type === 'galaxy') {
    const diameter = object.visual.visualRadius * 2;
    const shape = object.visual.galaxyShape ?? 'elliptical';
    const aspectRatio = object.visual.galaxyAxisRatio ?? 0.72;
    const material = createGalaxyMaterial(
      object.visual.color ?? '#b7c9e5',
      assets.galaxyTextures[shape],
    );
    const halo = new THREE.Sprite(material);

    halo.name = `${object.id}-galaxy-impostor`;
    halo.scale.set(diameter, diameter * aspectRatio, 1);
    halo.material.rotation = THREE.MathUtils.degToRad(object.visual.galaxyRotationDegrees ?? 0);
    halo.layers.enable(PICKING_LAYER);
    halo.userData['objectId'] = object.id;
    halo.visible = false;
    root.add(halo);

    return {
      root,
      rotatingBody: null,
      lunarEclipse: null,
      solarEclipse: null,
      observerCorona: null,
      pickables: [halo],
      lod: {
        nearRoot: null,
        farSprite: halo,
        nearMaterials: [],
        nearBlend: 0,
        visibilityBlend: 0,
        farAlpha: 0,
        farBaseOpacity: 0.58,
        farBaseDiameter: diameter,
        farAspectRatio: aspectRatio,
      },
    };
  }

  const visualRadius = object.visual.visualRadius;
  const nearRoot = new THREE.Group();

  nearRoot.name = `${object.id}-near-representation`;
  nearRoot.visible = false;
  root.add(nearRoot);

  const bodyMaterial = createBodyMaterial(object, quality);
  const body = new THREE.Mesh(assets.sphereGeometry, bodyMaterial);

  body.name = `${object.id}-body`;
  body.scale.setScalar(visualRadius);
  nearRoot.add(body);

  const nearMaterials: ManagedLodMaterial[] = [manageMaterial(bodyMaterial)];
  let observerCorona: THREE.Sprite | null = null;
  const lunarEclipse =
    object.id === 'moon' ? new LunarEclipseVisual(assets.sphereGeometry, visualRadius) : null;
  const solarEclipse =
    object.id === 'earth' ? new SolarEclipseVisual(assets.sphereGeometry, visualRadius) : null;

  if (lunarEclipse) {
    nearRoot.add(lunarEclipse.mesh);
  }
  if (solarEclipse) {
    nearRoot.add(solarEclipse.mesh, solarEclipse.path);
  }

  const hitRadius = Math.max(visualRadius * 1.45, object.type === 'star' ? 2.2 : 0.72);
  const hitTarget = new THREE.Mesh(assets.selectionGeometry, assets.selectionMaterial);

  hitTarget.name = `${object.id}-selection-target`;
  hitTarget.scale.setScalar(hitRadius);
  hitTarget.layers.set(PICKING_LAYER);
  hitTarget.userData['objectId'] = object.id;
  root.add(hitTarget);

  if (object.type === 'star') {
    const glowMaterial = createGlowMaterial(
      object.visual.color ?? '#fff5dc',
      object.id === 'sun' ? 0.48 : 0.72,
      assets.glowTexture,
    );
    const glow = new THREE.Sprite(glowMaterial);
    const glowScale = object.id === 'sun' ? visualRadius * 3.35 : visualRadius * 4.2;

    glow.scale.set(glowScale, glowScale, 1);
    nearRoot.add(glow);
    nearMaterials.push(manageMaterial(glowMaterial));

    if (object.id === 'sun') {
      root.add(new THREE.PointLight(0xfff2d6, 4.2, 1_500, 0.35));
      observerCorona = new THREE.Sprite(createGlowMaterial('#d8edff', 0.32, assets.glowTexture));
      observerCorona.name = 'solar-eclipse-observer-corona';
      observerCorona.scale.setScalar(visualRadius * 4.4);
      observerCorona.visible = false;
      nearRoot.add(observerCorona);
    }
  }

  if (object.visual.atmosphereColor) {
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: object.visual.atmosphereColor,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(assets.sphereGeometry, atmosphereMaterial);

    atmosphere.name = `${object.id}-atmosphere`;
    atmosphere.scale.setScalar(visualRadius * (object.id === 'earth' ? 1.015 : 1.075));
    nearRoot.add(atmosphere);
    nearMaterials.push(manageMaterial(atmosphereMaterial));
  }

  if (object.visual.hasRings) {
    const ringMaterial = createPlanetaryRingMaterial(object, quality);
    const rings = new THREE.Mesh(assets.ringGeometry, ringMaterial);

    rings.name = `${object.id}-rings`;
    rings.userData['kind'] = 'planetary-rings';
    rings.renderOrder = 1;
    rings.scale.setScalar(visualRadius);
    rings.rotation.x = Math.PI / 2;
    rings.rotation.z = object.id === 'saturn' ? -0.47 : -0.1;
    nearRoot.add(rings);
    nearMaterials.push(manageMaterial(ringMaterial));
  }

  const farBaseOpacity = object.type === 'star' ? 0.82 : object.type === 'moon' ? 0.58 : 0.7;

  return {
    root,
    rotatingBody: body,
    lunarEclipse,
    solarEclipse,
    observerCorona,
    pickables: [hitTarget],
    lod: {
      nearRoot,
      farSprite: null,
      nearMaterials,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity,
      farBaseDiameter: 0,
      farAspectRatio: 1,
    },
  };
}

function createInvisibleVisual(root: THREE.Group): CelestialVisual {
  return {
    root,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    observerCorona: null,
    pickables: [],
    lod: {
      nearRoot: null,
      farSprite: null,
      nearMaterials: [],
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: 0,
      farBaseDiameter: 0,
      farAspectRatio: 1,
    },
  };
}

export function createSharedGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour le halo stellaire.');
  }

  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createGalaxyTextures(): Readonly<Record<GalaxyVisualShape, THREE.Texture>> {
  return {
    spiral: createGalaxyTexture('spiral'),
    elliptical: createGalaxyTexture('elliptical'),
    irregular: createGalaxyTexture('irregular'),
  };
}

function createGalaxyTexture(shape: GalaxyVisualShape): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour les imposteurs galactiques.');
  }

  if (shape === 'spiral') {
    drawSpiralGalaxy(context);
  } else if (shape === 'irregular') {
    drawIrregularGalaxy(context);
  } else {
    drawEllipticalGalaxy(context);
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function drawSpiralGalaxy(context: CanvasRenderingContext2D): void {
  drawRadialGlow(context, 128, 128, 5, 118, 0.92);
  const random = mulberry32(0xa31d_2026);

  context.fillStyle = '#ffffff';
  for (let index = 0; index < 1_650; index += 1) {
    const radialProgress = Math.pow(random(), 0.58);
    const arm = index % 4;
    const angle =
      arm * (Math.PI / 2) +
      radialProgress * Math.PI * 3.6 +
      (random() - 0.5) * (0.24 + radialProgress * 0.52);
    const radius = 8 + radialProgress * 109;
    const x = 128 + Math.cos(angle) * radius;
    const y = 128 + Math.sin(angle) * radius * 0.76;
    const size = 0.35 + random() * (1.45 - radialProgress * 0.45);

    context.globalAlpha = (1 - radialProgress * 0.7) * (0.18 + random() * 0.66);
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  drawRadialGlow(context, 128, 128, 1, 34, 1);
}

function drawEllipticalGalaxy(context: CanvasRenderingContext2D): void {
  context.save();
  context.translate(128, 128);
  context.scale(1, 0.72);
  const gradient = context.createRadialGradient(0, 0, 1, 0, 0, 118);

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.78)');
  gradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.22)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(-128, -178, 256, 356);
  context.restore();
}

function drawIrregularGalaxy(context: CanvasRenderingContext2D): void {
  const random = mulberry32(0x1c10_2026);
  const blobs = [
    [94, 118, 58, 0.72],
    [142, 98, 65, 0.88],
    [164, 148, 54, 0.6],
    [111, 164, 49, 0.52],
  ] as const;

  for (const [x, y, radius, alpha] of blobs) {
    drawRadialGlow(context, x, y, 2, radius, alpha);
  }
  context.fillStyle = '#ffffff';
  for (let index = 0; index < 520; index += 1) {
    const x = 67 + random() * 132;
    const y = 66 + random() * 131;
    const size = 0.4 + random() * 1.35;

    context.globalAlpha = 0.12 + random() * 0.58;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawRadialGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  opacity: number,
): void {
  const gradient = context.createRadialGradient(x, y, innerRadius, x, y, outerRadius);

  gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
  gradient.addColorStop(0.24, `rgba(255, 255, 255, ${opacity * 0.68})`);
  gradient.addColorStop(0.62, `rgba(255, 255, 255, ${opacity * 0.2})`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(x - outerRadius, y - outerRadius, outerRadius * 2, outerRadius * 2);
}

export function createSelectionMarker(): THREE.Sprite {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour le marqueur de sélection.');
  }

  context.clearRect(0, 0, 128, 128);
  context.strokeStyle = 'rgba(150, 217, 255, 0.9)';
  context.lineWidth = 3;
  context.setLineDash([8, 7]);
  context.beginPath();
  context.arc(64, 64, 51, 0, Math.PI * 2);
  context.stroke();

  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'selection-marker';
  sprite.renderOrder = 20;

  return sprite;
}

function createBodyMaterial(object: SpaceObject, quality: GraphicQuality): THREE.Material {
  const primaryColor = object.visual.color ?? '#b6c3da';

  if (object.type === 'star') {
    return new THREE.MeshBasicMaterial({
      color: primaryColor,
      toneMapped: false,
      transparent: true,
    });
  }

  const texture = createBodyTexture(object, quality);

  return new THREE.MeshStandardMaterial({
    color: texture ? 0xffffff : primaryColor,
    map: texture,
    roughness: object.id === 'earth' ? 0.72 : 0.88,
    metalness: 0,
    emissive: object.visual.emissiveColor ?? 0x000000,
    emissiveIntensity: object.visual.emissiveIntensity ?? 0,
    transparent: true,
  });
}

function createBodyTexture(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.Texture | undefined {
  if (object.id === 'earth') {
    const resolution = quality === 'high' ? 2048 : 1024;
    const texture = createStaticTexture(`textures/earth-blue-marble-${resolution}.jpg`, quality);

    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;

    return texture;
  }

  return quality === 'low' ? undefined : createProceduralTexture(object, quality);
}

function createProceduralTexture(
  object: SpaceObject,
  quality: Exclude<GraphicQuality, 'low'>,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = quality === 'high' ? 384 : 256;
  canvas.height = quality === 'high' ? 192 : 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(`Canvas 2D indisponible pour la texture de ${object.id}.`);
  }

  const primary = new THREE.Color(object.visual.color ?? '#8894a6');
  const secondary = new THREE.Color(
    object.visual.secondaryColor ?? object.visual.color ?? '#657080',
  );
  const image = context.createImageData(canvas.width, canvas.height);
  const random = mulberry32(hashString(object.id));
  const sinX025 = new Float32Array(canvas.width);
  const x047 = new Float32Array(canvas.width);
  const x018 = new Float32Array(canvas.width);

  for (let x = 0; x < canvas.width; x += 1) {
    sinX025[x] = Math.sin(x * 0.025) * 1.7;
    x047[x] = x * 0.047;
    x018[x] = x * 0.018;
  }

  for (let y = 0; y < canvas.height; y += 1) {
    const latitude = Math.abs(y / canvas.height - 0.5) * 2;
    const sinY011 = Math.sin(y * 0.11) * 2.3;
    const polarFade = 1 - latitude * 0.12;

    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const bands = Math.sin(y * 0.13 + sinX025[x]!) * 0.5 + 0.5;
      const continents = Math.sin(x047[x]! + sinY011) + Math.sin(y * 0.071 - x018[x]!);
      const noise = random() * 0.28;
      const pattern =
        object.id === 'jupiter' || object.id === 'saturn'
          ? bands * 0.78 + noise
          : 0.32 + continents * 0.12 + noise;
      const mix = THREE.MathUtils.clamp(pattern, 0, 1);

      image.data[offset] = Math.round(
        (primary.r + (secondary.r - primary.r) * mix) * 255 * polarFade,
      );
      image.data[offset + 1] = Math.round(
        (primary.g + (secondary.g - primary.g) * mix) * 255 * polarFade,
      );
      image.data[offset + 2] = Math.round(
        (primary.b + (secondary.b - primary.b) * mix) * 255 * polarFade,
      );
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = quality === 'high' ? 4 : 2;

  return texture;
}

function createPlanetaryRingMaterial(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.MeshStandardMaterial {
  const isSaturn = object.id === 'saturn';
  const texture = isSaturn ? createStaticTexture('textures/saturn-rings.svg', quality) : undefined;

  return new THREE.MeshStandardMaterial({
    color: texture ? 0xffffff : 0x8fa8b0,
    map: texture,
    emissive: isSaturn ? 0x6d5b3f : 0x18252a,
    emissiveMap: texture,
    emissiveIntensity: isSaturn ? 0.42 : 0.14,
    transparent: true,
    opacity: isSaturn ? 0.92 : 0.3,
    alphaTest: isSaturn ? 0.018 : 0,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function createStaticTexture(path: string, quality: GraphicQuality): THREE.Texture {
  const image = document.createElement('img');
  const texture = new THREE.Texture(image);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = quality === 'high' ? 4 : quality === 'medium' ? 2 : 1;
  image.onload = () => {
    texture.needsUpdate = true;
  };
  image.src = path;

  return texture;
}

function createGlowMaterial(
  color: string,
  opacity: number,
  texture: THREE.Texture,
): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function createGalaxyMaterial(color: string, texture: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

function manageMaterial(material: THREE.Material): ManagedLodMaterial {
  return {
    material,
    baseOpacity: material.opacity,
    baseDepthWrite: material.depthWrite,
  };
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
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b_79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
