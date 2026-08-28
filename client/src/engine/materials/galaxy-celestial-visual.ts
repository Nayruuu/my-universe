import * as THREE from 'three';
import type { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { getGalaxyRenderScale } from '../coordinates/galaxy-scale-model';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createGalaxyVolumeVisual } from './galaxy-volume-visual';
import {
  manageMaterial,
  type CelestialVisual,
  type CelestialVisualAssets,
} from './celestial-visual-types';

const GALAXY_SELECTION_RADIUS_PER_RENDER_DIAMETER = 0.575;

export function createGalaxyCelestialVisual(
  root: THREE.Group,
  object: SpaceObject,
  quality: GraphicQuality,
  assets: CelestialVisualAssets,
): CelestialVisual {
  const scaleModel = getGalaxyRenderScale(object);
  const diameter = scaleModel.renderDiameter;
  const shape = object.visual.galaxyShape ?? 'elliptical';
  const isMilkyWay = object.id === 'milky-way';
  const aspectRatio = isMilkyWay ? 1 : (object.visual.galaxyAxisRatio ?? 0.72);
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
  halo.userData['objectId'] = object.id;
  halo.userData['renderDiameter'] = diameter;
  halo.userData['diameterTreatment'] = scaleModel.diameterTreatment;
  if (scaleModel.physicalSceneDiameter !== null) {
    halo.userData['physicalSceneDiameter'] = scaleModel.physicalSceneDiameter;
  }
  if (isMilkyWay) {
    halo.name = 'milky-way-galaxy-picking-proxy';
    halo.material.opacity = 0;
    halo.material.colorWrite = false;
    halo.layers.enable(PICKING_LAYER);
    halo.userData['pickingProxyOnly'] = true;
    halo.userData['apparentScaleTreatment'] = 'single-procedural-galaxy-with-invisible-pick-proxy';
    halo.userData['scientificConfidence'] = 'illustrative';
    halo.material.userData['visualStyle'] = 'transparent-procedural-galaxy-picking-proxy';
  }
  halo.visible = false;
  root.add(halo);
  const hitTarget = isMilkyWay
    ? null
    : createGalaxySelectionTarget(
        object,
        diameter,
        assets.selectionGeometry,
        assets.selectionMaterial,
      );

  if (hitTarget) {
    root.add(hitTarget);
  }

  const volume = isMilkyWay ? null : createGalaxyVolumeVisual(object, quality);

  if (volume) {
    volume.root.visible = false;
    root.add(volume.root);
  }

  const pickables = hitTarget ? [hitTarget, ...volume!.pickables] : [halo];

  return {
    root,
    lensingForeground: null,
    rotatingBody: null,
    lunarEclipse: null,
    solarEclipse: null,
    supernova: null,
    observerCorona: null,
    pickables,
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

function createGalaxySelectionTarget(
  object: SpaceObject,
  renderDiameter: number,
  geometry: THREE.SphereGeometry,
  material: THREE.MeshBasicMaterial,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const target = new THREE.Mesh(geometry, material);
  const hitRadius = renderDiameter * GALAXY_SELECTION_RADIUS_PER_RENDER_DIAMETER;

  target.name = `${object.id}-selection-target`;
  target.scale.setScalar(hitRadius);
  target.layers.set(PICKING_LAYER);
  target.userData['objectId'] = object.id;
  target.userData['visualRole'] = 'selection-proxy';
  target.userData['sizeTreatment'] = 'screen-synchronized-margin-around-rendered-galaxy';
  target.userData['renderDiameterRadiusMultiplier'] = GALAXY_SELECTION_RADIUS_PER_RENDER_DIAMETER;

  return target;
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
