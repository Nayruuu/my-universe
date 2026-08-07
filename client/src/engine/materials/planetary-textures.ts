import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { getObservedSurfaceDefinition } from './observed-surface-assets';
import { getPlanetaryVisualProfile, type PlanetaryVisualProfile } from './planetary-visual-profile';
import { getRepresentativeAtmosphereDefinition } from './representative-atmosphere-assets';
import { hashString, mulberry32 } from './visual-random';

export const DEFERRED_TEXTURE_SOURCE = 'deferredTextureSource';
export const DEFERRED_PROCEDURAL_TEXTURE_FACTORY = 'deferredProceduralTextureFactory';
export type DeferredProceduralTextureFactory = () => HTMLCanvasElement;

export function createBodyTexture(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.Texture | undefined {
  const profile = getPlanetaryVisualProfile(quality);

  if (object.id === 'earth') {
    const resolution = profile.photographicTextureResolution;
    const texture = createStaticTexture(`textures/earth-blue-marble-${resolution}.jpg`, quality);

    configureBodyFixedTexture(texture);
    texture.userData['visualStyle'] = 'observed-nasa-blue-marble';
    texture.userData['scientificConfidence'] = 'observed';

    return texture;
  }
  if (object.id === 'jupiter') {
    const texture = createStaticTexture(
      `textures/jupiter-hubble-${profile.photographicTextureResolution}.jpg`,
      quality,
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.userData['visualStyle'] = 'observed-hubble-global-map';
    texture.userData['scientificConfidence'] = 'observed';
    texture.userData['polarTreatment'] = 'illustrative-stretch';
    texture.userData['bodyFixedAlignment'] = 'illustrative-source-epoch';

    return texture;
  }
  const atmosphereTexture = createRepresentativeAtmosphereTexture(object.id, quality);

  if (atmosphereTexture) {
    return atmosphereTexture;
  }
  if (profile.proceduralTextureWidth !== 0) {
    const observedTexture = createObservedBodyTexture(object.id, profile, quality);

    if (observedTexture) {
      return observedTexture;
    }
  }

  return profile.proceduralTextureWidth === 0
    ? undefined
    : createProceduralTexture(object, profile);
}

function createRepresentativeAtmosphereTexture(
  objectId: string,
  quality: GraphicQuality,
): THREE.Texture | null {
  const definition = getRepresentativeAtmosphereDefinition(objectId);

  if (!definition) {
    return null;
  }
  const texture = createStaticTexture(definition.assetPath, quality);

  configureBodyFixedTexture(texture);
  texture.userData['visualStyle'] = definition.visualStyle;
  texture.userData['scientificConfidence'] = definition.scientificConfidence;
  texture.userData['sourceName'] = definition.sourceName;
  texture.userData['sourceUrl'] = definition.sourceUrl;
  texture.userData['colorTreatment'] = definition.colorTreatment;
  texture.userData['projectionTreatment'] = definition.projectionTreatment;
  texture.userData['bodyFixedAlignment'] = 'illustrative-source-epoch';

  return texture;
}

function createObservedBodyTexture(
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
    const definition = getObservedSurfaceDefinition(objectId);

    if (!definition) {
      return null;
    }
    texture = createStaticTexture(definition.assetPath, quality);
    texture.userData['visualStyle'] = definition.visualStyle;
    texture.userData['scientificConfidence'] = definition.scientificConfidence;
    texture.userData['mission'] = definition.mission;
    texture.userData['sourceUrl'] = definition.sourceUrl;
    texture.userData['colorTreatment'] = definition.colorTreatment;
  }

  configureBodyFixedTexture(texture);
  if (getObservedSurfaceDefinition(objectId)) {
    texture.userData['bodyFixedAlignment'] = 'source-cartographic-grid';
  }

  return texture;
}

export function createLunarReliefTexture(quality: GraphicQuality): THREE.Texture {
  const texture = createStaticTexture('textures/moon-lola-relief-1024.jpg', quality);

  texture.colorSpace = THREE.NoColorSpace;
  configureBodyFixedTexture(texture);
  texture.userData['visualStyle'] = 'observed-lola-elevation';
  texture.userData['scientificConfidence'] = 'observed';

  return texture;
}

function createProceduralTexture(
  object: SpaceObject,
  profile: PlanetaryVisualProfile,
): THREE.CanvasTexture {
  const placeholder = document.createElement('canvas');

  placeholder.width = 1;
  placeholder.height = 1;
  const texture = new THREE.CanvasTexture(placeholder);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = profile.textureAnisotropy;
  texture.userData['visualStyle'] = 'procedural-planetary-surface';
  texture.userData['scientificConfidence'] = 'procedural';
  texture.userData[DEFERRED_PROCEDURAL_TEXTURE_FACTORY] = (() =>
    renderProceduralTexture(object, profile)) satisfies DeferredProceduralTextureFactory;

  return texture;
}

function renderProceduralTexture(
  object: SpaceObject,
  profile: PlanetaryVisualProfile,
): HTMLCanvasElement {
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
  const x047 = new Float32Array(canvas.width);
  const x018 = new Float32Array(canvas.width);

  for (let x = 0; x < canvas.width; x += 1) {
    x047[x] = x * 0.047;
    x018[x] = x * 0.018;
  }

  for (let y = 0; y < canvas.height; y += 1) {
    const latitude = Math.abs(y / canvas.height - 0.5) * 2;
    const sinY011 = Math.sin(y * 0.11) * 2.3;
    const polarFade = 1 - latitude * 0.12;

    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const continents = Math.sin(x047[x]! + sinY011) + Math.sin(y * 0.071 - x018[x]!);
      const noise = random() * 0.28;
      const pattern = 0.32 + continents * 0.12 + noise;
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

  return canvas;
}

export function createEarthLayerTexture(
  layer: 'clouds' | 'night-lights',
  profile: PlanetaryVisualProfile,
  quality: GraphicQuality,
): THREE.Texture {
  const texture = createStaticTexture(
    `textures/earth-${layer}-${profile.photographicTextureResolution}.jpg`,
    quality,
  );

  configureBodyFixedTexture(texture);

  return texture;
}

function configureBodyFixedTexture(texture: THREE.Texture): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.userData['longitudeConvention'] = 'east-positive';
  texture.userData['bodyFixedAlignment'] = 'iau-prime-meridian';
}

export function createStaticTexture(path: string, quality: GraphicQuality): THREE.Texture {
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
