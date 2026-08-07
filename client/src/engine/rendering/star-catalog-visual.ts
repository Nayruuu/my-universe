import * as THREE from 'three';
import type { GraphicQuality } from '../../data/models/universe.models';
import { colorIndexToRgb } from '../materials/star-color';
import { applyStellarPhotosphereAppearance } from '../materials/stellar-photosphere-material';
import { getStellarVisualProfile } from '../materials/stellar-visual-profile';
import { CATALOG_STAR_VISUAL_RADIUS, StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { createStarCatalogActiveDetail } from './star-catalog-active-detail';
import { createStarCatalogGeometry, stellarCatalogSurfaceSeed } from './star-catalog-geometry';
import { createStarCatalogMaterial } from './star-catalog-material';
import { getStarCatalogOpticalProfile } from './star-catalog-optical-profile';
import { createStarCatalogSelectionPoint } from './star-catalog-selection-point';

const CATALOG_PICKING_PRIORITY = 20;

export interface StarCatalogVisual {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly activeDetail: THREE.Group;
  readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly visibleIndices: Uint8Array;
}

export function createStarCatalogVisual(registry: StarCatalogRegistry): StarCatalogVisual {
  const catalog = registry.catalog;
  const visibleIndices = new Uint8Array(catalog.count);
  const points = new THREE.Points(createStarCatalogGeometry(registry), createStarCatalogMaterial());
  const selectionPoint = createStarCatalogSelectionPoint();
  const { activeDetail, activeHalo, activeCore } = createStarCatalogActiveDetail();

  points.name = 'observed-hyg-star-catalog';
  points.layers.enable(PICKING_LAYER);
  points.visible = false;
  points.renderOrder = 2;
  points.userData['catalogCount'] = catalog.count;
  points.userData['referenceEpochJulianDay'] = catalog.referenceEpochJulianDay;
  points.userData['scientificConfidence'] = 'observed';
  points.userData['visualScale'] = 'compressed';
  points.userData['objectIds'] = registry.objectIds;
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'procedural-spectral-photospheres-v3';
  points.userData['pointSizeModel'] =
    'magnitude-with-bounded-camera-proximity-and-optical-magnification';
  points.userData['observerBoundaryOpacity'] = 1;
  points.userData['pickingPriority'] = CATALOG_PICKING_PRIORITY;

  return { points, selectionPoint, activeDetail, activeHalo, activeCore, visibleIndices };
}

export function applyStarCatalogQuality(visual: StarCatalogVisual, quality: GraphicQuality): void {
  const profile = getStarCatalogOpticalProfile(quality);

  visual.points.material.uniforms['diffractionStrength']!.value = profile.diffractionStrength;
  visual.points.material.uniforms['airyStrength']!.value = profile.airyStrength;
  visual.points.material.uniforms['surfaceDetail']!.value = profile.surfaceDetail;
  visual.activeCore.material.uniforms['granulationStrength']!.value = profile.granulationStrength;
  visual.points.userData['quality'] = quality;
}

export function applyActiveCatalogStarAppearance(
  visual: StarCatalogVisual,
  registry: StarCatalogRegistry,
  index: number,
  haloSize: number,
  coreOpacity: number,
): number {
  const colorIndex = registry.catalog.colorIndicesBv[index]!;
  const [red, green, blue] = colorIndexToRgb(colorIndex);
  const profile = getStellarVisualProfile(
    registry.catalog.spectralTypes[index] ?? null,
    colorIndex,
  );
  const color = new THREE.Color(red, green, blue);
  const surfaceSeed = stellarCatalogSurfaceSeed(registry.catalog.catalogIds[index]!);

  (visual.activeHalo.material.uniforms['starColor']!.value as THREE.Color).copy(color);
  visual.activeHalo.material.uniforms['coronaStrength']!.value = profile.coronaStrength;
  visual.activeHalo.material.uniforms['cellScale']!.value = profile.cellScale;
  visual.activeHalo.material.uniforms['surfaceContrast']!.value = profile.surfaceContrast;
  visual.activeHalo.material.uniforms['faculaStrength']!.value = profile.faculaStrength;
  visual.activeHalo.material.uniforms['spotStrength']!.value = profile.spotStrength;
  visual.activeHalo.material.uniforms['surfaceSeed']!.value = surfaceSeed;
  visual.activeHalo.material.uniforms['surfaceProfile']!.value = profile.shaderIndex;
  visual.activeHalo.material.uniforms['pointSize']!.value = haloSize * profile.visualScale;
  visual.activeCore.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS * profile.visualScale);
  applyStellarPhotosphereAppearance(visual.activeCore.material, {
    color,
    profile,
    surfaceSeed,
    opacity: coreOpacity,
    granulationStrength: visual.activeCore.material.uniforms['granulationStrength']!
      .value as number,
  });
  visual.activeHalo.userData['visualFamily'] = profile.family;
  visual.activeCore.userData['visualFamily'] = profile.family;

  return profile.visualScale;
}
