import * as THREE from 'three';
import { GalaxyVisualShape, GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { LunarEclipseVisual } from './lunar-eclipse-visual';
import { getPlanetaryVisualProfile, type PlanetaryVisualProfile } from './planetary-visual-profile';
import { SolarEclipseVisual } from './solar-eclipse-visual';
import { getBlackHoleVisualProfile } from './black-hole-visual-profile';
import { createStellarPhotosphereMaterial } from './stellar-photosphere-material';
import {
  getStellarVisualProfile,
  getStellarVisualProfileFromTemperature,
  type StellarVisualProfile,
} from './stellar-visual-profile';
import { SupernovaVisual } from './supernova-visual';
import { createGalaxyVolumeVisual } from './galaxy-volume-visual';

export interface ManagedLodMaterial {
  material: THREE.Material;
  baseOpacity: number;
  baseDepthWrite: boolean;
}

export interface CelestialLodRepresentation {
  nearRoot: THREE.Group | null;
  farSprite: THREE.Sprite | null;
  nearMaterials: ManagedLodMaterial[];
  deferredTextures: THREE.Texture[];
  deferredTexturesRequested: boolean;
  nearBlend: number;
  visibilityBlend: number;
  farAlpha: number;
  farBaseOpacity: number;
  farBaseDiameter: number;
  farAspectRatio: number;
}

export interface CelestialVisual {
  root: THREE.Group;
  lensingForeground: THREE.Object3D | null;
  rotatingBody: THREE.Object3D | null;
  lunarEclipse: LunarEclipseVisual | null;
  solarEclipse: SolarEclipseVisual | null;
  supernova: SupernovaVisual | null;
  observerCorona: THREE.Sprite | null;
  pickables: THREE.Object3D[];
  lod: CelestialLodRepresentation;
}

export interface CelestialVisualAssets {
  glowTexture: THREE.Texture;
  photonRingTexture: THREE.Texture;
  galaxyTextures: Readonly<Record<GalaxyVisualShape, THREE.Texture>>;
  sphereGeometry: THREE.SphereGeometry;
  selectionGeometry: THREE.SphereGeometry;
  ringGeometry: THREE.RingGeometry;
  selectionMaterial: THREE.MeshBasicMaterial;
}

const DEFERRED_TEXTURE_SOURCE = 'deferredTextureSource';
const STELLAR_GRANULATION_BY_QUALITY = {
  low: 0.08,
  medium: 0.18,
  high: 0.28,
} as const satisfies Record<GraphicQuality, number>;

export function requestCelestialLodTextures(lod: CelestialLodRepresentation): number {
  if (lod.deferredTexturesRequested) {
    return 0;
  }
  lod.deferredTexturesRequested = true;
  let requestedTextures = 0;

  for (const texture of lod.deferredTextures) {
    const source = texture.userData[DEFERRED_TEXTURE_SOURCE];
    const image: unknown = texture.image;

    if (typeof source !== 'string' || !(image instanceof HTMLImageElement)) {
      continue;
    }
    image.src = source;
    requestedTextures += 1;
  }

  return requestedTextures;
}

export function createCelestialVisualAssets(quality: GraphicQuality): CelestialVisualAssets {
  const segments = quality === 'low' ? 24 : quality === 'medium' ? 48 : 72;

  return {
    glowTexture: createSharedGlowTexture(),
    photonRingTexture: createPhotonRingTexture(),
    galaxyTextures: createGalaxyTextures(quality),
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

  if (object.type === 'region' || object.type === 'universe') {
    return createInvisibleVisual(root);
  }

  if (object.type === 'black-hole') {
    return createBlackHoleVisual(root, object, quality, assets);
  }

  if (object.type === 'supernova' || object.type === 'supernova-remnant') {
    return createSupernovaCelestialVisual(root, object, quality, assets);
  }

  if (object.type === 'galaxy') {
    const diameter = object.visual.visualRadius * 2;
    const shape = object.visual.galaxyShape ?? 'elliptical';
    const aspectRatio = object.visual.galaxyAxisRatio ?? 0.72;
    const isNearbyUniverseCatalogObject =
      typeof object.metadata?.['nearbyUniverseLabelRank'] === 'number';
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
    const volume = object.id === 'milky-way' ? null : createGalaxyVolumeVisual(object, quality);

    if (volume) {
      volume.root.visible = false;
      root.add(volume.root);
    }

    return {
      root,
      lensingForeground: null,
      rotatingBody: null,
      lunarEclipse: null,
      solarEclipse: null,
      supernova: null,
      observerCorona: null,
      pickables: volume ? [halo, ...volume.pickables] : [halo],
      lod: {
        nearRoot: volume?.root ?? null,
        farSprite: halo,
        nearMaterials: volume?.materials.map((nearMaterial) => manageMaterial(nearMaterial)) ?? [],
        deferredTextures: [],
        deferredTexturesRequested: false,
        nearBlend: 0,
        visibilityBlend: 0,
        farAlpha: 0,
        farBaseOpacity: isNearbyUniverseCatalogObject ? 0.86 : 0.72,
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
  const planetaryProfile = getPlanetaryVisualProfile(quality);
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

  if (object.id === 'earth' && planetaryProfile.showEarthClouds) {
    const cloudTexture = createEarthLayerTexture('clouds', planetaryProfile, quality);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: cloudTexture,
      alphaMap: cloudTexture,
      transparent: true,
      opacity: 0.68,
      alphaTest: 0.055,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(assets.sphereGeometry, cloudMaterial);

    cloudMaterial.userData['scientificConfidence'] = 'observed';
    cloudMaterial.userData['visualStyle'] = 'nasa-cloud-composite';
    clouds.name = 'earth-cloud-layer';
    clouds.renderOrder = 2;
    clouds.scale.setScalar(1.012);
    body.add(clouds);
    nearMaterials.push(manageMaterial(cloudMaterial));
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

    if (object.metadata?.['exoplanetHost'] === true) {
      const systemLight = new THREE.PointLight(object.visual.color ?? '#fff0d2', 3.2, 420, 0.55);

      systemLight.name = `${object.id}-system-light`;
      systemLight.userData['scientificConfidence'] = 'illustrative';
      systemLight.userData['visualRole'] = 'local-exoplanet-illumination';
      root.add(systemLight);
    }

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
    const atmosphereMaterial = createAtmosphereMaterial(
      object.visual.atmosphereColor,
      planetaryProfile.atmosphereIntensity,
    );
    const atmosphere = new THREE.Mesh(assets.sphereGeometry, atmosphereMaterial);

    atmosphere.name = `${object.id}-atmosphere`;
    atmosphere.scale.setScalar(visualRadius * (object.id === 'earth' ? 1.045 : 1.075));
    nearRoot.add(atmosphere);
    nearMaterials.push(manageMaterial(atmosphereMaterial));
  }

  if (object.visual.hasRings) {
    const ringMaterial = createPlanetaryRingMaterial(object, quality);
    const rings = new THREE.Mesh(assets.ringGeometry, ringMaterial);

    rings.name = `${object.id}-rings`;
    rings.userData['kind'] = 'planetary-rings';
    rings.renderOrder = 1;
    rings.rotation.x = Math.PI / 2;
    body.add(rings);
    nearMaterials.push(manageMaterial(ringMaterial));
  }

  const farBaseOpacity = object.type === 'star' ? 0.82 : object.type === 'moon' ? 0.58 : 0.7;

  return {
    root,
    lensingForeground: null,
    rotatingBody: body,
    lunarEclipse,
    solarEclipse,
    supernova: null,
    observerCorona,
    pickables: [hitTarget],
    lod: {
      nearRoot,
      farSprite: null,
      nearMaterials,
      deferredTextures: collectDeferredTextures(nearMaterials),
      deferredTexturesRequested: false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity,
      farBaseDiameter: 0,
      farAspectRatio: 1,
    },
  };
}

function createBlackHoleVisual(
  root: THREE.Group,
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
  const activity = object.visual.blackHoleActivity ?? 'dormant';
  const profile = getBlackHoleVisualProfile(activity, quality);
  const radius = object.visual.visualRadius;
  const nearRoot = new THREE.Group();
  const lensingForeground = new THREE.Group();

  nearRoot.name = `${object.id}-near-representation`;
  nearRoot.visible = false;
  lensingForeground.name = `${object.id}-lensing-foreground`;
  nearRoot.add(lensingForeground);
  root.add(nearRoot);

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.Mesh(assets.sphereGeometry, coreMaterial);

  core.name = `${object.id}-event-horizon`;
  core.scale.setScalar(radius);
  core.renderOrder = 10;
  core.userData['scientificConfidence'] = 'illustrative';
  core.userData['visualStyle'] = 'event-horizon-silhouette';
  lensingForeground.add(core);

  const haloMaterial = new THREE.SpriteMaterial({
    map: assets.glowTexture,
    color: object.visual.secondaryColor ?? '#8fb9e8',
    transparent: true,
    opacity: profile.lensingOpacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMaterial);

  halo.name = `${object.id}-local-lensing-halo`;
  halo.scale.setScalar(radius * profile.lensingScale);
  halo.renderOrder = 7;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['visualStyle'] = 'local-lensing-cue';
  lensingForeground.add(halo);

  const photonRingMaterial = new THREE.SpriteMaterial({
    map: assets.photonRingTexture,
    color: object.visual.color ?? '#f3a45f',
    transparent: true,
    opacity: profile.photonRingOpacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const photonRing = new THREE.Sprite(photonRingMaterial);

  photonRing.name = `${object.id}-photon-ring`;
  photonRing.scale.setScalar(radius * 2.8);
  photonRing.renderOrder = 9;
  photonRing.userData['scientificConfidence'] = 'illustrative';
  photonRing.userData['visualStyle'] = 'stylized-photon-ring';
  lensingForeground.add(photonRing);

  const nearMaterials: ManagedLodMaterial[] = [
    manageMaterial(coreMaterial),
    manageMaterial(haloMaterial),
    manageMaterial(photonRingMaterial),
  ];
  const nuclearCluster = createBlackHoleNuclearStarCluster(object, quality, radius, assets);

  if (nuclearCluster) {
    nearRoot.add(nuclearCluster.points);
    nearMaterials.push(manageMaterial(nuclearCluster.material));
  }

  if (profile.showAccretionDisk) {
    const diskFrame = new THREE.Group();
    const inclination = object.visual.accretionDiskInclinationDegrees ?? 62;
    const diskMaterial = createBlackHoleAccretionMaterial(
      object.visual.color ?? '#f3a45f',
      object.visual.secondaryColor ?? '#8fb9e8',
      profile.diskOpacity,
    );
    const disk = new THREE.Mesh(assets.ringGeometry, diskMaterial);

    diskFrame.name = `${object.id}-accretion-frame`;
    diskFrame.rotation.x = THREE.MathUtils.degToRad(inclination);
    disk.name = `${object.id}-accretion-disk`;
    disk.scale.setScalar(radius * profile.diskScale);
    disk.renderOrder = 8;
    disk.userData['scientificConfidence'] = 'illustrative';
    disk.userData['visualStyle'] = 'stylized-accretion-emission';
    diskFrame.add(disk);
    lensingForeground.add(diskFrame);
    nearMaterials.push(manageMaterial(diskMaterial));

    if (profile.showJets) {
      const jets = createBlackHoleJets(
        object,
        radius,
        profile.jetLength,
        profile.jetOpacity,
        profile.segmentCount,
      );

      diskFrame.add(jets.root);
      nearMaterials.push(manageMaterial(jets.material));
    }
  }

  const hitTarget = new THREE.Mesh(assets.selectionGeometry, assets.selectionMaterial);

  hitTarget.name = `${object.id}-selection-target`;
  hitTarget.scale.setScalar(Math.max(radius * profile.lensingScale * 0.5, 1.2));
  hitTarget.layers.set(PICKING_LAYER);
  hitTarget.userData['objectId'] = object.id;
  root.add(hitTarget);

  const farMaterial = new THREE.SpriteMaterial({
    map: assets.glowTexture,
    color: object.visual.color ?? '#f3a45f',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const farSprite = new THREE.Sprite(farMaterial);
  const farDiameter = radius * profile.farDiameterScale;

  farSprite.name = `${object.id}-black-hole-impostor`;
  farSprite.scale.set(farDiameter, farDiameter, 1);
  farSprite.visible = false;
  farSprite.renderOrder = 6;
  farSprite.userData['scientificConfidence'] = 'illustrative';
  farSprite.userData['visualStyle'] = 'unresolved-black-hole-marker';
  root.add(farSprite);

  return {
    root,
    lensingForeground,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    supernova: null,
    observerCorona: null,
    pickables: [hitTarget],
    lod: {
      nearRoot,
      farSprite,
      nearMaterials,
      deferredTextures: [],
      deferredTexturesRequested: false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: profile.farOpacity,
      farBaseDiameter: farDiameter,
      farAspectRatio: 1,
    },
  };
}

function createSupernovaCelestialVisual(
  root: THREE.Group,
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
  const supernova = new SupernovaVisual(object, quality, assets.sphereGeometry, assets.glowTexture);
  const hitTarget = new THREE.Mesh(assets.selectionGeometry, assets.selectionMaterial);
  const farDiameter = object.visual.visualRadius * 6;

  hitTarget.name = `${object.id}-selection-target`;
  hitTarget.scale.setScalar(Math.max(object.visual.visualRadius * 2.2, 1.4));
  hitTarget.layers.set(PICKING_LAYER);
  hitTarget.userData['objectId'] = object.id;
  supernova.farSprite.scale.setScalar(farDiameter);
  root.add(supernova.nearRoot, supernova.farSprite, hitTarget);

  return {
    root,
    lensingForeground: null,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    supernova,
    observerCorona: null,
    pickables: [hitTarget],
    lod: {
      nearRoot: supernova.nearRoot,
      farSprite: supernova.farSprite,
      nearMaterials: supernova.materials.map(manageMaterial),
      deferredTextures: [],
      deferredTexturesRequested: false,
      nearBlend: 0,
      visibilityBlend: 0,
      farAlpha: 0,
      farBaseOpacity: 0.95,
      farBaseDiameter: farDiameter,
      farAspectRatio: 1,
    },
  };
}

function createBlackHoleNuclearStarCluster(
  object: SpaceObject,
  quality: GraphicQuality,
  radius: number,
  assets: CelestialVisualAssets,
): {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  material: THREE.PointsMaterial;
} | null {
  const pointCount = quality === 'high' ? 6_144 : quality === 'medium' ? 3_072 : 0;

  if (
    pointCount === 0 ||
    object.metadata?.['lensingEnvironment'] !== 'procedural-nuclear-star-cluster'
  ) {
    return null;
  }

  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const random = mulberry32(hashString(object.id));

  for (let index = 0; index < pointCount; index += 1) {
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const radialDistance = radius * (0.12 + random() ** 1.72 * 6.5);
    const positionOffset = index * 3;

    positions[positionOffset] = Math.cos(azimuth) * horizontal * radialDistance;
    positions[positionOffset + 1] = vertical * radialDistance * 0.82;
    positions[positionOffset + 2] = Math.sin(azimuth) * horizontal * radialDistance;

    const brightness = 0.54 + random() ** 3.8 * 0.46;
    const warmth = random() ** 0.42;

    colors[positionOffset] = brightness * (0.94 + warmth * 0.06);
    colors[positionOffset + 1] = brightness * (0.68 + warmth * 0.16);
    colors[positionOffset + 2] = brightness * (0.62 - warmth * 0.28);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: assets.glowTexture,
    size: radius * (quality === 'high' ? 0.032 : 0.038),
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: quality === 'high' ? 0.76 : 0.66,
    alphaTest: 0.015,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);

  points.name = `${object.id}-nuclear-star-cluster`;
  points.renderOrder = 1;
  points.frustumCulled = false;
  points.userData['scientificConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'procedural-3d-nuclear-star-cluster';
  points.userData['pointCount'] = pointCount;

  return { points, material };
}

function createBlackHoleAccretionMaterial(
  hotColor: string,
  coolColor: string,
  opacity: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      hotColor: { value: new THREE.Color(hotColor) },
      coolColor: { value: new THREE.Color(coolColor) },
      layerOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 hotColor;
      uniform vec3 coolColor;
      uniform float layerOpacity;
      varying vec2 vUv;

      void main() {
        vec2 centered = vUv - vec2(0.5);
        float radius = length(centered) * 2.0;
        float innerEdge = smoothstep(0.58, 0.66, radius);
        float outerEdge = 1.0 - smoothstep(0.86, 1.0, radius);
        float ring = innerEdge * outerEdge;
        float heat = 1.0 - smoothstep(0.58, 1.0, radius);
        float turbulence = 0.78 + 0.22 * sin(radius * 92.0 + atan(centered.y, centered.x) * 7.0);
        float doppler = 0.68 + 0.32 * smoothstep(-0.45, 0.45, centered.x);
        vec3 color = mix(coolColor, hotColor, heat) * turbulence * doppler;

        if (ring < 0.005 || layerOpacity < 0.005) {
          discard;
        }
        gl_FragColor = vec4(color, ring * layerOpacity);
      }
    `,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  material.userData['scientificConfidence'] = 'illustrative';
  material.userData['visualStyle'] = 'stylized-accretion-emission';
  material.onBeforeRender = () => {
    material.uniforms['layerOpacity']!.value = material.opacity;
  };

  return material;
}

function createBlackHoleJets(
  object: SpaceObject,
  radius: number,
  lengthScale: number,
  opacity: number,
  segmentCount: number,
): { root: THREE.Group; material: THREE.MeshBasicMaterial } {
  const length = radius * lengthScale;
  const geometry = new THREE.ConeGeometry(
    radius * 0.07,
    length,
    Math.round(segmentCount / 4),
    1,
    true,
  );
  const material = new THREE.MeshBasicMaterial({
    color: object.visual.secondaryColor ?? '#8fb9e8',
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const root = new THREE.Group();
  const forward = new THREE.Mesh(geometry, material);
  const backward = new THREE.Mesh(geometry, material);

  root.name = `${object.id}-relativistic-jets`;
  root.userData['scientificConfidence'] = 'illustrative';
  root.userData['visualStyle'] = 'stylized-relativistic-jets';
  forward.position.z = length * 0.5;
  forward.rotation.x = Math.PI / 2;
  backward.position.z = -length * 0.5;
  backward.rotation.x = -Math.PI / 2;
  root.add(forward, backward);

  return { root, material };
}

function createInvisibleVisual(root: THREE.Group): CelestialVisual {
  return {
    root,
    lensingForeground: null,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    supernova: null,
    observerCorona: null,
    pickables: [],
    lod: {
      nearRoot: null,
      farSprite: null,
      nearMaterials: [],
      deferredTextures: [],
      deferredTexturesRequested: false,
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

export function createPhotonRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour l’anneau photonique.');
  }

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.76, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.82, 'rgba(255, 255, 255, 0.22)');
  gradient.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.16)');
  gradient.addColorStop(0.94, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

export function getGalaxyTextureResolution(quality: GraphicQuality): number {
  return quality === 'low' ? 256 : quality === 'medium' ? 384 : 512;
}

function createGalaxyTextures(
  quality: GraphicQuality,
): Readonly<Record<GalaxyVisualShape, THREE.Texture>> {
  return {
    spiral: createGalaxyTexture('spiral', quality),
    elliptical: createGalaxyTexture('elliptical', quality),
    irregular: createGalaxyTexture('irregular', quality),
  };
}

function createGalaxyTexture(
  shape: GalaxyVisualShape,
  quality: GraphicQuality,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const resolution = getGalaxyTextureResolution(quality);

  canvas.width = resolution;
  canvas.height = resolution;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponible pour les imposteurs galactiques.');
  }

  context.save();
  context.scale(resolution / 256, resolution / 256);
  if (shape === 'spiral') {
    drawSpiralGalaxy(context);
  } else if (shape === 'irregular') {
    drawIrregularGalaxy(context);
  } else {
    drawEllipticalGalaxy(context);
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = quality === 'high' ? 4 : quality === 'medium' ? 2 : 1;

  return texture;
}

function drawSpiralGalaxy(context: CanvasRenderingContext2D): void {
  drawRadialGlow(context, 128, 128, 5, 118, 0.38, [205, 224, 255], [63, 92, 151]);
  const random = mulberry32(0xa31d_2026);

  context.globalCompositeOperation = 'source-over';
  context.lineCap = 'round';
  context.filter = 'blur(4px)';
  for (let arm = 0; arm < 4; arm += 1) {
    context.strokeStyle = 'rgba(92, 132, 194, 0.12)';
    context.lineWidth = 13;
    traceSpiralArm(context, arm, 0);
    for (let filament = -1; filament <= 1; filament += 1) {
      context.strokeStyle =
        filament === 0 ? 'rgba(214, 229, 255, 0.12)' : 'rgba(126, 164, 219, 0.08)';
      context.lineWidth = filament === 0 ? 3.2 : 5;
      traceSpiralArm(context, arm, filament * 0.11);
    }
  }
  context.filter = 'blur(1px)';
  context.globalCompositeOperation = 'destination-out';
  context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  context.lineWidth = 4.2;
  for (let arm = 0; arm < 4; arm += 1) {
    traceSpiralArm(context, arm, 0.13);
  }
  context.filter = 'none';
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 180; index += 1) {
    const radialProgress = Math.pow(random(), 0.62);
    const arm = index % 4;
    const angle =
      arm * (Math.PI / 2) +
      radialProgress * Math.PI * 2.45 +
      (random() - 0.5) * (0.14 + radialProgress * 0.28);
    const radius = 6 + radialProgress * 111;

    context.fillStyle = index % 13 === 0 ? '#ffd19a' : '#dcecff';
    context.globalAlpha = (1 - radialProgress * 0.68) * (0.08 + random() * 0.24);
    context.beginPath();
    context.arc(
      128 + Math.cos(angle) * radius,
      128 + Math.sin(angle) * radius,
      0.16 + random() * 0.32,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  drawRadialGlow(context, 128, 128, 1, 34, 1, [255, 247, 224], [238, 171, 102]);
}

function traceSpiralArm(context: CanvasRenderingContext2D, arm: number, offset: number): void {
  context.beginPath();
  for (let step = 0; step < 120; step += 1) {
    const progress = step / 119;
    const radius = 4 + progress * 112 + Math.sin(progress * 43 + arm * 1.3) * progress * 1.2;
    const angle =
      arm * (Math.PI / 2) +
      progress * Math.PI * 2.45 +
      offset +
      Math.sin(progress * 18 + arm * 1.7) * 0.035;
    const x = 128 + Math.cos(angle) * radius;
    const y = 128 + Math.sin(angle) * radius;

    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function drawEllipticalGalaxy(context: CanvasRenderingContext2D): void {
  context.save();
  context.translate(128, 128);
  context.scale(1, 0.72);
  const gradient = context.createRadialGradient(0, 0, 1, 0, 0, 118);

  gradient.addColorStop(0, 'rgba(255, 242, 211, 1)');
  gradient.addColorStop(0.18, 'rgba(245, 218, 180, 0.82)');
  gradient.addColorStop(0.52, 'rgba(174, 197, 230, 0.28)');
  gradient.addColorStop(1, 'rgba(90, 119, 164, 0)');
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

  for (const [index, [x, y, radius, alpha]] of blobs.entries()) {
    drawRadialGlow(
      context,
      x,
      y,
      2,
      radius,
      alpha,
      index % 2 === 0 ? [199, 224, 255] : [255, 219, 178],
      [79, 119, 175],
    );
  }
  for (let index = 0; index < 520; index += 1) {
    const x = 67 + random() * 132;
    const y = 66 + random() * 131;
    const size = 0.4 + random() * 1.35;

    context.fillStyle = index % 11 === 0 ? '#ffd19a' : '#dcecff';
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
  innerColor: readonly [number, number, number] = [255, 255, 255],
  outerColor: readonly [number, number, number] = innerColor,
): void {
  const gradient = context.createRadialGradient(x, y, innerRadius, x, y, outerRadius);

  gradient.addColorStop(0, rgba(innerColor, opacity));
  gradient.addColorStop(0.24, rgba(innerColor, opacity * 0.68));
  gradient.addColorStop(0.62, rgba(outerColor, opacity * 0.2));
  gradient.addColorStop(1, rgba(outerColor, 0));
  context.fillStyle = gradient;
  context.fillRect(x - outerRadius, y - outerRadius, outerRadius * 2, outerRadius * 2);
}

function rgba(color: readonly [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
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
  context.strokeStyle = 'rgba(132, 202, 241, 0.56)';
  context.lineWidth = 1.5;
  context.setLineDash([4, 9]);
  context.beginPath();
  context.arc(64, 64, 51, 0, Math.PI * 2);
  context.stroke();

  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: true,
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
    return createStellarPhotosphereMaterial({
      color: primaryColor,
      profile: getObjectStellarVisualProfile(object),
      surfaceSeed: hashString(object.id) / 4_294_967_296,
      opacity: 1,
      granulationStrength: STELLAR_GRANULATION_BY_QUALITY[quality],
      radiance: object.visual.emissiveIntensity ?? 1,
    });
  }

  const planetaryProfile = getPlanetaryVisualProfile(quality);
  const texture = createBodyTexture(object, quality);
  const lunarRelief =
    object.id === 'moon' && planetaryProfile.proceduralTextureWidth !== 0
      ? createLunarReliefTexture(quality)
      : null;
  const earthNightLights =
    object.id === 'earth' && planetaryProfile.showEarthNightLights
      ? createEarthLayerTexture('night-lights', planetaryProfile, quality)
      : null;
  const illustrativeShadowFill =
    texture !== undefined &&
    (object.type === 'exoplanet' ||
      object.id === 'jupiter' ||
      object.id === 'saturn' ||
      object.id === 'uranus' ||
      object.id === 'neptune');
  const material = new THREE.MeshStandardMaterial({
    color: texture ? 0xffffff : primaryColor,
    map: texture,
    bumpMap: lunarRelief,
    bumpScale: lunarRelief ? 0.018 : 0,
    roughness: object.id === 'earth' ? 0.68 : 0.88,
    metalness: 0,
    emissive: earthNightLights
      ? 0xffb26f
      : illustrativeShadowFill
        ? primaryColor
        : (object.visual.emissiveColor ?? 0x000000),
    emissiveMap: earthNightLights ?? (illustrativeShadowFill ? texture : null),
    emissiveIntensity: earthNightLights
      ? 0.92
      : illustrativeShadowFill
        ? object.type === 'exoplanet'
          ? 0.11
          : 0.18
        : (object.visual.emissiveIntensity ?? 0),
    transparent: true,
  });

  if (object.id === 'earth') {
    material.userData['visualStyle'] = earthNightLights
      ? 'nasa-surface-and-night-lights'
      : 'nasa-surface';
  }
  if (texture && (object.id === 'moon' || object.id === 'mars')) {
    material.userData['visualStyle'] = 'observed-planetary-surface';
  }
  if (texture && object.id === 'venus') {
    material.userData['visualStyle'] = 'radar-derived-planetary-surface';
  }
  if (lunarRelief) {
    material.userData['reliefScale'] = 'visually-exaggerated';
  }
  if (illustrativeShadowFill) {
    material.userData['shadowFill'] = 'illustrative';
  }

  return material;
}

function createBodyTexture(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.Texture | undefined {
  const profile = getPlanetaryVisualProfile(quality);

  if (object.id === 'earth') {
    const resolution = profile.photographicTextureResolution;
    const texture = createStaticTexture(`textures/earth-blue-marble-${resolution}.jpg`, quality);

    configureEarthTexture(texture);

    return texture;
  }
  if (object.id === 'jupiter' && profile.proceduralTextureWidth !== 0) {
    const texture = createStaticTexture(
      `textures/jupiter-hubble-${profile.photographicTextureResolution}.jpg`,
      quality,
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.userData['visualStyle'] = 'observed-hubble-global-map';
    texture.userData['scientificConfidence'] = 'observed';
    texture.userData['polarTreatment'] = 'illustrative-stretch';

    return texture;
  }
  if (profile.proceduralTextureWidth !== 0) {
    const observedTexture = createObservedRockyBodyTexture(object.id, profile, quality);

    if (observedTexture) {
      return observedTexture;
    }
  }

  return profile.proceduralTextureWidth === 0
    ? undefined
    : createProceduralTexture(object, profile);
}

function createObservedRockyBodyTexture(
  objectId: string,
  profile: PlanetaryVisualProfile,
  quality: GraphicQuality,
): THREE.Texture | null {
  const resolution = profile.photographicTextureResolution;
  let texture: THREE.Texture;

  if (objectId === 'moon') {
    texture = createStaticTexture(`textures/moon-lroc-${resolution}.jpg`, quality);
    texture.userData['visualStyle'] = 'observed-lro-color-mosaic';
    texture.userData['scientificConfidence'] = 'observed';
    texture.userData['visualTreatment'] = 'aesthetic-processing';
  } else if (objectId === 'mars') {
    texture = createStaticTexture(`textures/mars-viking-${resolution}.jpg`, quality);
    texture.userData['visualStyle'] = 'observed-viking-colorized-mosaic';
    texture.userData['scientificConfidence'] = 'observed';
    texture.userData['colorConfidence'] = 'illustrative';
  } else if (objectId === 'venus') {
    texture = createStaticTexture(`textures/venus-magellan-${resolution}.jpg`, quality);
    texture.userData['visualStyle'] = 'observed-magellan-radar-simulated-color';
    texture.userData['scientificConfidence'] = 'observed';
    texture.userData['colorConfidence'] = 'simulated';
  } else {
    return null;
  }

  texture.wrapS = THREE.RepeatWrapping;

  return texture;
}

function createLunarReliefTexture(quality: GraphicQuality): THREE.Texture {
  const texture = createStaticTexture('textures/moon-lola-relief-1024.jpg', quality);

  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.userData['visualStyle'] = 'observed-lola-elevation';
  texture.userData['scientificConfidence'] = 'observed';

  return texture;
}

function createProceduralTexture(
  object: SpaceObject,
  profile: PlanetaryVisualProfile,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');

  canvas.width = profile.proceduralTextureWidth;
  canvas.height = profile.proceduralTextureWidth / 2;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(`Canvas 2D indisponible pour la texture de ${object.id}.`);
  }

  const primary = new THREE.Color(object.visual.color ?? '#8894a6').convertLinearToSRGB();
  const secondary = new THREE.Color(
    object.visual.secondaryColor ?? object.visual.color ?? '#657080',
  ).convertLinearToSRGB();
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
        object.id === 'saturn' ? bands * 0.78 + noise : 0.32 + continents * 0.12 + noise;
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
  if (profile.showGasGiantStorms && object.id === 'saturn') {
    drawSaturnStorm(context, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = profile.textureAnisotropy;
  texture.userData['visualStyle'] =
    object.id === 'saturn'
      ? 'procedural-atmospheric-bands-and-storms'
      : 'procedural-planetary-surface';
  if (object.id === 'saturn' && profile.showGasGiantStorms) {
    texture.userData['storm'] = 'representative-polar-storm';
  }

  return texture;
}

function drawSaturnStorm(context: CanvasRenderingContext2D, width: number, height: number): void {
  drawAtmosphericStorm(context, width * 0.58, height * 0.18, width * 0.035, height * 0.018, [
    'rgba(225, 218, 197, 0.48)',
    'rgba(187, 169, 139, 0.28)',
    'rgba(255, 255, 255, 0)',
  ]);
}

function drawAtmosphericStorm(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  colors: readonly [string, string, string],
): void {
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);

  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.58, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.save();
  context.translate(x, y);
  context.scale(radiusX, radiusY);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 1, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function createEarthLayerTexture(
  layer: 'clouds' | 'night-lights',
  profile: PlanetaryVisualProfile,
  quality: GraphicQuality,
): THREE.Texture {
  const texture = createStaticTexture(
    `textures/earth-${layer}-${profile.photographicTextureResolution}.jpg`,
    quality,
  );

  configureEarthTexture(texture);

  return texture;
}

function configureEarthTexture(texture: THREE.Texture): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
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
  texture.userData[DEFERRED_TEXTURE_SOURCE] = path;

  return texture;
}

function collectDeferredTextures(materials: readonly ManagedLodMaterial[]): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();

  for (const managed of materials) {
    for (const value of Object.values(managed.material)) {
      if (
        value instanceof THREE.Texture &&
        typeof value.userData[DEFERRED_TEXTURE_SOURCE] === 'string'
      ) {
        textures.add(value);
      }
    }
  }

  return [...textures];
}

function createAtmosphereMaterial(color: string, intensity: number): THREE.ShaderMaterial {
  const uniforms = {
    atmosphereColor: { value: new THREE.Color(color) },
    intensity: { value: intensity },
    layerOpacity: { value: 0.34 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 atmosphereColor;
      uniform float intensity;
      uniform float layerOpacity;
      varying vec3 vWorldNormal;
      varying vec3 vViewDirection;

      void main() {
        float horizon = 1.0 - abs(dot(normalize(vWorldNormal), normalize(vViewDirection)));
        float scattering = pow(clamp(horizon, 0.0, 1.0), 2.35);
        float alpha = scattering * layerOpacity * intensity;
        vec3 radiance = atmosphereColor * (0.42 + scattering * 0.96) * intensity;
        gl_FragColor = vec4(radiance, alpha);
      }
    `,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });

  material.userData['visualStyle'] = 'fresnel-atmospheric-scattering';
  material.onBeforeRender = () => {
    uniforms.layerOpacity.value = material.opacity;
  };

  return material;
}

function getObjectStellarVisualProfile(object: SpaceObject): StellarVisualProfile {
  const spectralType = object.physical?.spectralType ?? null;
  const colorIndexValue = object.metadata?.['colorIndexBv'];
  const colorIndex = typeof colorIndexValue === 'number' ? colorIndexValue : Number.NaN;

  if (spectralType || Number.isFinite(colorIndex)) {
    return getStellarVisualProfile(spectralType, colorIndex);
  }

  return getStellarVisualProfileFromTemperature(object.physical?.temperatureK ?? Number.NaN);
}

function createGlowMaterial(
  color: string,
  opacity: number,
  texture: THREE.Texture,
): THREE.SpriteMaterial {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  material.userData['photographicGlow'] = true;

  return material;
}

function createGalaxyMaterial(color: string, texture: THREE.Texture): THREE.SpriteMaterial {
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.64);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: tint,
    transparent: true,
    opacity: 0.46,
    blending: THREE.NormalBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  material.userData['visualStyle'] = 'structured-galaxy-impostor';
  material.userData['layers'] = ['outer-star-halo', 'dust-lanes', 'stellar-core'];

  return material;
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
