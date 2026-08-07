import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { getPlanetaryVisualProfile } from './planetary-visual-profile';
import {
  createBodyTexture,
  createEarthLayerTexture,
  createLunarReliefTexture,
  createStaticTexture,
  DEFERRED_TEXTURE_SOURCE,
} from './planetary-textures';
import { createStellarPhotosphereMaterial } from './stellar-photosphere-material';
import {
  getStellarVisualProfile,
  getStellarVisualProfileFromTemperature,
  type StellarVisualProfile,
} from './stellar-visual-profile';
import type { ManagedLodMaterial } from './celestial-visual-types';
import { hashString } from './visual-random';

const STELLAR_GRANULATION_BY_QUALITY = {
  low: 0.08,
  medium: 0.18,
  high: 0.28,
} as const satisfies Record<GraphicQuality, number>;

export function createCelestialBodyMaterial(
  object: SpaceObject,
  quality: GraphicQuality,
): THREE.Material {
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

export function createPlanetaryRingMaterial(
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

export function collectDeferredTextures(materials: readonly ManagedLodMaterial[]): THREE.Texture[] {
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

export function createAtmosphereMaterial(color: string, intensity: number): THREE.ShaderMaterial {
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

export function createGlowMaterial(
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

function getObjectStellarVisualProfile(object: SpaceObject): StellarVisualProfile {
  const spectralType = object.physical?.spectralType ?? null;
  const colorIndexValue = object.metadata?.['colorIndexBv'];
  const colorIndex = typeof colorIndexValue === 'number' ? colorIndexValue : Number.NaN;

  if (spectralType || Number.isFinite(colorIndex)) {
    return getStellarVisualProfile(spectralType, colorIndex);
  }

  return getStellarVisualProfileFromTemperature(object.physical?.temperatureK ?? Number.NaN);
}
