import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createGalaxyVolumeVisual } from './galaxy-volume-visual';
import {
  manageMaterial,
  type CelestialVisual,
  type CelestialVisualAssets,
} from './celestial-visual-types';

export function createGalaxyCelestialVisual(
  root: THREE.Group,
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
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
      nearMaterials: volume?.materials.map(manageMaterial) ?? [],
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
