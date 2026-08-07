import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { SupernovaVisual } from './supernova-visual';
import {
  manageMaterial,
  type CelestialVisual,
  type CelestialVisualAssets,
} from './celestial-visual-types';

export function createSupernovaCelestialVisual(
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
