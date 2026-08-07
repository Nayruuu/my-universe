import * as THREE from 'three';
import { type CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  createCosmicGroupFilamentGeometry,
  createCosmicGroupPointGeometry,
} from './cosmic-group-catalog-geometry';
import {
  createCosmicGroupFilamentMaterial,
  createCosmicGroupPointMaterial,
  createCosmicGroupSelectionPoint,
} from './cosmic-group-catalog-materials';
import { type CosmicMapLayers } from './cosmic-map-policy';

export interface CosmicGroupCatalogVisual {
  readonly filaments: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly visibleIndices: Uint8Array;
  readonly pointRevealThresholds: Float32Array;
  readonly filamentRevealThresholds: Float32Array;
  readonly renderIndexByObjectId: ReadonlyMap<string, number>;
}

export function createCosmicGroupCatalogVisual(
  registry: CosmicGroupCatalogRegistry,
  layers: CosmicMapLayers,
): CosmicGroupCatalogVisual {
  const visibleIndices = new Uint8Array(registry.catalog.count);
  const filamentPairs = registry.catalog.filamentPairs;
  const filamentGeometry = createCosmicGroupFilamentGeometry(registry, filamentPairs);
  const pointGeometry = createCosmicGroupPointGeometry(registry);
  const filaments = new THREE.LineSegments(
    filamentGeometry.geometry,
    createCosmicGroupFilamentMaterial(),
  );
  const points = new THREE.Points(pointGeometry.geometry, createCosmicGroupPointMaterial());
  const selectionPoint = createCosmicGroupSelectionPoint();
  const renderIndexByObjectId = new Map(
    pointGeometry.objectIds.map((objectId, index) => [objectId, index]),
  );

  configureFilaments(filaments, filamentPairs.length / 2);
  configurePoints(points, pointGeometry.objectIds, visibleIndices, layers);
  points.layers.enable(PICKING_LAYER);
  selectionPoint.layers.enable(PICKING_LAYER);

  return {
    filaments,
    points,
    selectionPoint,
    visibleIndices,
    pointRevealThresholds: pointGeometry.revealThresholds,
    filamentRevealThresholds: filamentGeometry.revealThresholds,
    renderIndexByObjectId,
  };
}

function configureFilaments(
  filaments: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>,
  edgeCount: number,
): void {
  filaments.name = 'illustrative-cosmicflows4-filaments';
  filaments.visible = false;
  filaments.frustumCulled = false;
  filaments.renderOrder = 0;
  filaments.userData['edgeCount'] = edgeCount;
  filaments.userData['scientificConfidence'] = 'illustrative';
  filaments.userData['visualStyle'] = 'derived-nearest-neighbor-cosmic-filaments';
  filaments.userData['detailMode'] = 'camera-distance-confidence-fade';
  filaments.userData['source'] = 'Derived from Cosmicflows-4 group positions';
}

function configurePoints(
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  objectIds: readonly string[],
  visibleIndices: Uint8Array,
  layers: CosmicMapLayers,
): void {
  points.name = 'calculated-cosmicflows4-groups';
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 1;
  points.userData['catalogCount'] = objectIds.length;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'adaptive-unresolved-group-impostors';
  points.userData['source'] = 'Cosmicflows-4 · Tully et al. (2023)';
  points.userData['visualColorEncoding'] = 'illustrative-distance-gradient-near-warm-far-cool';
  points.userData['objectIds'] = objectIds;
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['activeCount'] = 0;
  points.userData['layerState'] = { ...layers };
}
