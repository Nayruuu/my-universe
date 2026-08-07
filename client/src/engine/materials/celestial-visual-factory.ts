import * as THREE from 'three';
import { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { LunarEclipseVisual } from './lunar-eclipse-visual';
import { getPlanetaryVisualProfile } from './planetary-visual-profile';
import { SolarEclipseVisual } from './solar-eclipse-visual';
import { createBlackHoleCelestialVisual } from './black-hole-celestial-visual';
import {
  collectDeferredTextures,
  createAtmosphereMaterial,
  createCelestialBodyMaterial,
  createGlowMaterial,
  createPlanetaryRingMaterial,
} from './celestial-body-materials';
import { createPhotonRingTexture, createSharedGlowTexture } from './celestial-canvas-assets';
import { createGalaxyCelestialVisual } from './galaxy-celestial-visual';
import { createGalaxyImpostorTextures } from './galaxy-impostor-textures';
import { createInvisibleCelestialVisual } from './invisible-celestial-visual';
import { createEarthLayerTexture, DEFERRED_TEXTURE_SOURCE } from './planetary-textures';
import {
  manageMaterial,
  type CelestialLodRepresentation,
  type CelestialVisual,
  type CelestialVisualAssets,
  type ManagedLodMaterial,
} from './celestial-visual-types';
import { createSupernovaCelestialVisual } from './supernova-celestial-visual';

export { getGalaxyTextureResolution } from './galaxy-impostor-textures';
export {
  createPhotonRingTexture,
  createSelectionMarker,
  createSharedGlowTexture,
} from './celestial-canvas-assets';
export type {
  CelestialLodRepresentation,
  CelestialVisual,
  CelestialVisualAssets,
  ManagedLodMaterial,
} from './celestial-visual-types';

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
    galaxyTextures: createGalaxyImpostorTextures(quality),
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
    return createInvisibleCelestialVisual(root);
  }

  if (object.type === 'black-hole') {
    return createBlackHoleCelestialVisual(root, object, quality, assets);
  }

  if (object.type === 'supernova' || object.type === 'supernova-remnant') {
    return createSupernovaCelestialVisual(root, object, quality, assets);
  }

  if (object.type === 'galaxy') {
    return createGalaxyCelestialVisual(root, object, quality, assets);
  }

  const visualRadius = object.visual.visualRadius;
  const nearRoot = new THREE.Group();

  nearRoot.name = `${object.id}-near-representation`;
  nearRoot.visible = false;
  root.add(nearRoot);

  const bodyMaterial = createCelestialBodyMaterial(object, quality);
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
    nearRoot.add(solarEclipse.mesh);
    body.add(solarEclipse.eventMapRoot);
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
