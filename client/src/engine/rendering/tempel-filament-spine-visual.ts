import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { getCosmicFilamentSpineRevealThreshold } from './cosmic-map-policy';

const TEMPEL_SOURCE_ID = 'sdss-dr8-tempel-filaments';
const TEMPEL_SOURCE_CITATION = 'Tempel et al. (2014), MNRAS 438, 3465';
const TILE_COUNT = 8;

interface SegmentRecord {
  readonly filamentIndex: number;
  readonly fromPointIndex: number;
  readonly toPointIndex: number;
  readonly objectId: string;
  readonly revealThreshold: number;
  readonly alpha: number;
}

export interface TempelFilamentTileState {
  readonly line: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly halo: LineSegments2;
  readonly revealThresholds: Float32Array;
  readonly visibleIndices: Uint8Array;
  readonly segmentCount: number;
  activeSegmentCount: number;
  activeHaloSegmentCount: number;
}

export interface TempelFilamentSpineVisual {
  readonly tileStates: readonly TempelFilamentTileState[];
  readonly tiles: readonly THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>[];
  readonly haloTiles: readonly LineSegments2[];
  readonly selectionLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly hoverLine: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly selectionHalo: LineSegments2;
  readonly hoverHalo: LineSegments2;
  readonly material: THREE.ShaderMaterial;
  readonly haloMaterial: LineMaterial;
  readonly filamentIndexByObjectId: ReadonlyMap<string, number>;
}

export function createTempelFilamentSpineVisual(
  catalog: TempelFilamentSpineCatalog,
  registry: CosmicStructureCatalogRegistry,
  sceneUnitsPerMpc: number,
): TempelFilamentSpineVisual {
  const filamentObjectIds = resolveFilamentObjectIds(catalog, registry);
  const filamentIndexByObjectId = new Map<string, number>();
  const material = createMaterial();
  const haloMaterial = createHaloMaterial();

  for (let index = 0; index < filamentObjectIds.length; index += 1) {
    filamentIndexByObjectId.set(filamentObjectIds[index]!, index);
  }
  const tileStates = createTileStates(
    catalog,
    filamentObjectIds,
    sceneUnitsPerMpc,
    material,
    haloMaterial,
  );

  return {
    tileStates,
    tiles: tileStates.map(({ line }) => line),
    haloTiles: tileStates.map(({ halo }) => halo),
    selectionLine: createHighlightLine('selected-tempel-filament-spine', 0xffe7a3, 0.98),
    hoverLine: createHighlightLine('hovered-tempel-filament-spine', 0xa8fff0, 0.82),
    selectionHalo: createHighlightHalo('selected-tempel-filament-spine-halo', 0xffd77a, 0.5),
    hoverHalo: createHighlightHalo('hovered-tempel-filament-spine-halo', 0x65f5dd, 0.38),
    material,
    haloMaterial,
    filamentIndexByObjectId,
  };
}

export function updateTempelFilamentHighlight(
  line: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>,
  halo: LineSegments2,
  catalog: TempelFilamentSpineCatalog,
  filamentIndex: number | undefined,
  sceneUnitsPerMpc: number,
  objectId: string | null,
): void {
  if (filamentIndex === undefined) {
    line.visible = false;
    line.userData['objectId'] = null;
    line.geometry.setDrawRange(0, 0);
    halo.visible = false;
    halo.userData['objectId'] = null;
    halo.geometry.instanceCount = 0;

    return;
  }
  const startPoint = catalog.pointOffsets[filamentIndex]!;
  const endPoint = catalog.pointOffsets[filamentIndex + 1]!;
  const positions = new Float32Array((endPoint - startPoint - 1) * 6);
  let outputOffset = 0;

  for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
    copyScaledPoint(catalog.positionsMpc, pointIndex, positions, outputOffset, sceneUnitsPerMpc);
    copyScaledPoint(
      catalog.positionsMpc,
      pointIndex + 1,
      positions,
      outputOffset + 3,
      sceneUnitsPerMpc,
    );
    outputOffset += 6;
  }
  line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  line.geometry.setDrawRange(0, positions.length / 3);
  line.geometry.computeBoundingSphere();
  line.userData['objectId'] = objectId;
  line.visible = true;
  halo.geometry.setPositions(positions);
  halo.geometry.instanceCount = positions.length / 6;
  halo.userData['objectId'] = objectId;
  halo.visible = true;
}

export function setTempelScreenSpaceLineWidth(material: LineMaterial, widthPixels: number): void {
  material.uniforms['linewidth']!.value = widthPixels;
}

function resolveFilamentObjectIds(
  catalog: TempelFilamentSpineCatalog,
  registry: CosmicStructureCatalogRegistry,
): readonly string[] {
  const objectIdByNumericId = new Map<number, string>();

  for (let index = 0; index < registry.catalog.count; index += 1) {
    const source = registry.catalog.metadata.sources[registry.catalog.sourceIndices[index]!]!;

    if (source.id === TEMPEL_SOURCE_ID) {
      objectIdByNumericId.set(
        registry.catalog.catalogNumericIds[index]!,
        registry.objectIds[index]!,
      );
    }
  }

  return Array.from(catalog.filamentIds, (filamentId) => {
    const objectId = objectIdByNumericId.get(filamentId);

    if (!objectId) {
      throw new Error(`Filament Tempel F${filamentId} absent du catalogue de structures.`);
    }

    return objectId;
  });
}

function createTileStates(
  catalog: TempelFilamentSpineCatalog,
  filamentObjectIds: readonly string[],
  sceneUnitsPerMpc: number,
  material: THREE.ShaderMaterial,
  haloMaterial: LineMaterial,
): readonly TempelFilamentTileState[] {
  const recordsByTile = Array.from({ length: TILE_COUNT }, () => [] as SegmentRecord[]);

  for (let filamentIndex = 0; filamentIndex < catalog.filamentCount; filamentIndex += 1) {
    const filamentId = catalog.filamentIds[filamentIndex]!;
    const objectId = filamentObjectIds[filamentIndex]!;
    const revealThreshold = filamentId === 1 ? 0 : getCosmicFilamentSpineRevealThreshold(objectId);
    const startPoint = catalog.pointOffsets[filamentIndex]!;
    const endPoint = catalog.pointOffsets[filamentIndex + 1]!;

    for (let pointIndex = startPoint; pointIndex < endPoint - 1; pointIndex += 1) {
      recordsByTile[getSegmentTile(catalog.positionsMpc, pointIndex)]!.push({
        filamentIndex,
        fromPointIndex: pointIndex,
        toPointIndex: pointIndex + 1,
        objectId,
        revealThreshold,
        alpha: getSegmentAlpha(catalog, pointIndex),
      });
    }
  }

  return recordsByTile.flatMap((records, tileIndex) => {
    if (records.length === 0) {
      return [];
    }
    records.sort(
      (left, right) =>
        left.revealThreshold - right.revealThreshold ||
        left.filamentIndex - right.filamentIndex ||
        left.fromPointIndex - right.fromPointIndex,
    );

    return [createTileState(records, tileIndex, catalog, sceneUnitsPerMpc, material, haloMaterial)];
  });
}

function createTileState(
  records: readonly SegmentRecord[],
  tileIndex: number,
  catalog: TempelFilamentSpineCatalog,
  sceneUnitsPerMpc: number,
  material: THREE.ShaderMaterial,
  haloMaterial: LineMaterial,
): TempelFilamentTileState {
  const positions = new Float32Array(records.length * 6);
  const alphas = new Float32Array(records.length * 2);
  const revealThresholds = new Float32Array(records.length);
  const visibleIndices = new Uint8Array(records.length * 2);
  const objectIds = new Array<string>(records.length * 2);

  for (let segmentIndex = 0; segmentIndex < records.length; segmentIndex += 1) {
    const record = records[segmentIndex]!;
    const positionOffset = segmentIndex * 6;
    const vertexOffset = segmentIndex * 2;

    copyScaledPoint(
      catalog.positionsMpc,
      record.fromPointIndex,
      positions,
      positionOffset,
      sceneUnitsPerMpc,
    );
    copyScaledPoint(
      catalog.positionsMpc,
      record.toPointIndex,
      positions,
      positionOffset + 3,
      sceneUnitsPerMpc,
    );
    alphas[vertexOffset] = record.alpha;
    alphas[vertexOffset + 1] = record.alpha;
    revealThresholds[segmentIndex] = record.revealThreshold;
    objectIds[vertexOffset] = record.objectId;
    objectIds[vertexOffset + 1] = record.objectId;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();
  const line = new THREE.LineSegments(geometry, material);
  const haloGeometry = new LineSegmentsGeometry();

  haloGeometry.setPositions(positions);
  haloGeometry.instanceCount = 0;
  const halo = new LineSegments2(haloGeometry, haloMaterial);

  line.name = `calculated-tempel-filament-spine-tile-${tileIndex}`;
  halo.name = `illustrative-tempel-filament-spine-halo-tile-${tileIndex}`;
  line.visible = false;
  halo.visible = false;
  line.renderOrder = 1;
  halo.renderOrder = 0;
  line.layers.enable(PICKING_LAYER);
  line.userData['tileIndex'] = tileIndex;
  line.userData['segmentCount'] = records.length;
  line.userData['activeSegmentCount'] = 0;
  line.userData['scientificConfidence'] = 'calculated';
  line.userData['representation'] = 'published-filament-spine-points';
  line.userData['source'] = TEMPEL_SOURCE_CITATION;
  line.userData['objectIds'] = objectIds;
  line.userData['visibleIndices'] = visibleIndices;
  line.userData['pickingPriority'] = 12;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['representation'] = 'screen-space-filament-halo';
  halo.userData['physicalWidth'] = false;
  halo.userData['activeSegmentCount'] = 0;
  halo.userData['source'] = TEMPEL_SOURCE_CITATION;

  return {
    line,
    halo,
    revealThresholds,
    visibleIndices,
    segmentCount: records.length,
    activeSegmentCount: 0,
    activeHaloSegmentCount: 0,
  };
}

function getSegmentTile(positions: Float32Array, pointIndex: number): number {
  const fromOffset = pointIndex * 3;
  const toOffset = fromOffset + 3;
  const x = positions[fromOffset]! + positions[toOffset]!;
  const y = positions[fromOffset + 1]! + positions[toOffset + 1]!;
  const z = positions[fromOffset + 2]! + positions[toOffset + 2]!;

  return Number(x >= 0) | (Number(y >= 0) << 1) | (Number(z >= 0) << 2);
}

function getSegmentAlpha(catalog: TempelFilamentSpineCatalog, pointIndex: number): number {
  const nextPointIndex = pointIndex + 1;
  const visitMap = (catalog.visitMap[pointIndex]! + catalog.visitMap[nextPointIndex]!) / 510;
  const density = (catalog.density[pointIndex]! + catalog.density[nextPointIndex]!) / 510;
  const orientation =
    (catalog.orientationStrength[pointIndex]! + catalog.orientationStrength[nextPointIndex]!) / 510;

  return 0.18 + visitMap * 0.14 + density * 0.38 + orientation * 0.3;
}

function copyScaledPoint(
  source: Float32Array,
  pointIndex: number,
  target: Float32Array,
  targetOffset: number,
  scale: number,
): void {
  const sourceOffset = pointIndex * 3;

  target[targetOffset] = source[sourceOffset]! * scale;
  target[targetOffset + 1] = source[sourceOffset + 1]! * scale;
  target[targetOffset + 2] = source[sourceOffset + 2]! * scale;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      spineOpacity: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float lineAlpha;
      varying float vAlpha;

      void main() {
        vAlpha = lineAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float spineOpacity;
      uniform float radiance;
      varying float vAlpha;

      void main() {
        vec3 color = mix(vec3(0.16, 0.62, 0.68), vec3(0.48, 1.0, 0.86), vAlpha);
        gl_FragColor = vec4(color * radiance, spineOpacity * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createHaloMaterial(): LineMaterial {
  return createScreenSpaceLineMaterial(0x2daec2, 0, true, THREE.AdditiveBlending);
}

function createHighlightLine(
  name: string,
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const line = new THREE.LineSegments(geometry, material);

  line.name = name;
  line.visible = false;
  line.frustumCulled = false;
  line.renderOrder = 7;
  line.userData['objectId'] = null;

  return line;
}

function createHighlightHalo(
  name: string,
  color: THREE.ColorRepresentation,
  opacity: number,
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  const material = createScreenSpaceLineMaterial(color, opacity, false, THREE.NormalBlending);
  const halo = new LineSegments2(geometry, material);

  geometry.instanceCount = 0;
  halo.name = name;
  halo.visible = false;
  halo.frustumCulled = false;
  halo.renderOrder = 6;
  halo.userData['objectId'] = null;
  halo.userData['scientificConfidence'] = 'illustrative';
  halo.userData['representation'] = 'screen-space-selection-halo';
  halo.userData['physicalWidth'] = false;

  return halo;
}

function createScreenSpaceLineMaterial(
  color: THREE.ColorRepresentation,
  opacity: number,
  depthTest: boolean,
  blending: THREE.Blending,
): LineMaterial {
  const material = new LineMaterial({
    color,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    blending,
    toneMapped: false,
    worldUnits: false,
  });

  material.dashed = false;

  return material;
}
