import * as THREE from 'three';
import type { CelestialVisual } from './celestial-visual-types';

export function createInvisibleCelestialVisual(root: THREE.Group): CelestialVisual {
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
