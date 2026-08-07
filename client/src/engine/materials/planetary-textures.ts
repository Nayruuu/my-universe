import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { getPlanetaryVisualProfile, type PlanetaryVisualProfile } from './planetary-visual-profile';
import { hashString, mulberry32 } from './visual-random';

export const DEFERRED_TEXTURE_SOURCE = 'deferredTextureSource';

export function createBodyTexture(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.Texture | undefined {
  const profile = getPlanetaryVisualProfile(quality);

  if (object.id === 'earth') {
    const resolution = profile.photographicTextureResolution;
    const texture = createStaticTexture(`textures/earth-blue-marble-${resolution}.jpg`, quality);

    configureBodyFixedTexture(texture);

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
    texture.userData['bodyFixedAlignment'] = 'illustrative-source-epoch';

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

  configureBodyFixedTexture(texture);

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
