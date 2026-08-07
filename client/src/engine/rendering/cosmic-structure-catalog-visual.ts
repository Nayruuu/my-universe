import * as THREE from 'three';
import { type CosmicStructureType } from '../../data/models/universe.models';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  type CosmicMapLayers,
  getCosmicStructureRevealThreshold,
  stableMapPriority,
} from './cosmic-map-policy';

const STRUCTURE_KIND_CODES = {
  cluster: 0,
  supercluster: 1,
  wall: 2,
  filament: 3,
  void: 4,
  basin: 5,
  attractor: 6,
  repeller: 7,
} as const satisfies Record<CosmicStructureType, number>;

export interface CosmicStructureCatalogVisual {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly visibleIndices: Uint8Array;
  readonly revealThresholds: Float32Array;
  readonly structureTypes: readonly CosmicStructureType[];
  readonly renderIndexByObjectId: ReadonlyMap<string, number>;
}

export function createCosmicStructureCatalogVisual(
  registry: CosmicStructureCatalogRegistry,
  layers: CosmicMapLayers,
): CosmicStructureCatalogVisual {
  const visibleIndices = new Uint8Array(registry.catalog.count);
  const pointGeometry = createGeometry(registry);
  const points = new THREE.Points(pointGeometry.geometry, createMaterial());
  const selectionPoint = createSelectionPoint();
  const renderIndexByObjectId = new Map<string, number>();

  points.name = 'calculated-cosmic-structure-symbols';
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.layers.enable(PICKING_LAYER);
  selectionPoint.layers.enable(PICKING_LAYER);
  points.userData['catalogCount'] = registry.catalog.count;
  points.userData['sourceCount'] = registry.catalog.metadata.sources.length;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['representation'] = 'typed-map-symbols';
  points.userData['voidRepresentation'] = 'adaptive-catalog-underdensity-volume';
  points.userData['voidBoundaryStyle'] = 'diffuse-fill-without-ring';
  points.userData['structureCounts'] = countStructures(registry.catalog.structureTypes);
  points.userData['objectIds'] = pointGeometry.objectIds;
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['activeCount'] = 0;
  points.userData['layerState'] = { ...layers };
  for (let index = 0; index < pointGeometry.objectIds.length; index += 1) {
    renderIndexByObjectId.set(pointGeometry.objectIds[index]!, index);
  }

  return {
    points,
    selectionPoint,
    visibleIndices,
    revealThresholds: pointGeometry.revealThresholds,
    structureTypes: pointGeometry.structureTypes,
    renderIndexByObjectId,
  };
}

function createGeometry(registry: CosmicStructureCatalogRegistry): {
  geometry: THREE.BufferGeometry;
  objectIds: readonly string[];
  revealThresholds: Float32Array;
  structureTypes: readonly CosmicStructureType[];
} {
  const catalog = registry.catalog;
  const records: StructureRenderRecord[] = Array.from(
    { length: catalog.count },
    (_, catalogIndex) => {
      const source = catalog.metadata.sources[catalog.sourceIndices[catalogIndex]!]!;
      const objectId = registry.objectIds[catalogIndex]!;

      return {
        catalogIndex,
        objectId,
        structureType: catalog.structureTypes[catalogIndex]!,
        revealThreshold:
          catalog.catalogNumericIds[catalogIndex]! <= 1
            ? 0
            : getCosmicStructureRevealThreshold(
                objectId,
                catalog.structureTypes[catalogIndex]!,
                source.id,
              ),
      };
    },
  );

  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const kinds = new Float32Array(catalog.count);
  const revealThresholds = new Float32Array(catalog.count);
  const shapeSeeds = new Float32Array(catalog.count);
  const objectIds = new Array<string>(catalog.count);
  const structureTypes = new Array<CosmicStructureType>(catalog.count);

  for (let renderIndex = 0; renderIndex < catalog.count; renderIndex += 1) {
    const record = records[renderIndex]!;
    const catalogIndex = record.catalogIndex;
    const sourceOffset = catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const structureType = record.structureType;
    const catalogRadius = catalog.radiiMpc[catalogIndex]!;
    const boundaryDistance = catalog.boundaryDistancesMpc[catalogIndex]!;
    const physicalExtent =
      structureType === 'void' && Number.isFinite(boundaryDistance)
        ? Math.max(catalogRadius, boundaryDistance)
        : catalogRadius;
    const radiusScale = Math.log1p(physicalExtent) * (structureType === 'void' ? 1.6 : 0.8);
    const populationScale = Math.log1p(catalog.galaxyCounts[catalogIndex]!) * 0.16;
    const typeScale = structureType === 'void' ? 5.2 : structureType === 'supercluster' ? 1.08 : 1;
    const minimumSize = structureType === 'void' ? 30 : 3.2;
    const maximumSize = structureType === 'void' ? 86 : 9;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), renderOffset);
    sizes[renderIndex] = THREE.MathUtils.clamp(
      (2.6 + radiusScale + populationScale) * typeScale,
      minimumSize,
      maximumSize,
    );
    alphas[renderIndex] =
      structureType === 'void'
        ? 0.78 + catalog.confidences[catalogIndex]! * 0.18
        : 0.28 + catalog.confidences[catalogIndex]! * 0.42;
    kinds[renderIndex] = STRUCTURE_KIND_CODES[structureType];
    revealThresholds[renderIndex] = record.revealThreshold;
    shapeSeeds[renderIndex] = stableMapPriority(`${record.objectId}:shape`);
    objectIds[renderIndex] = record.objectId;
    structureTypes[renderIndex] = structureType;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('structureKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('revealThreshold', new THREE.BufferAttribute(revealThresholds, 1));
  geometry.setAttribute('shapeSeed', new THREE.BufferAttribute(shapeSeeds, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();

  return { geometry, objectIds, revealThresholds, structureTypes };
}

interface StructureRenderRecord {
  readonly catalogIndex: number;
  readonly objectId: string;
  readonly structureType: CosmicStructureType;
  readonly revealThreshold: number;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
      detailScale: { value: 1 },
      detailLevel: { value: 0 },
      layerMask: { value: new THREE.Vector4(1, 1, 1, 1) },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float structureKind;
      attribute float revealThreshold;
      attribute float shapeSeed;
      uniform float pixelRatio;
      uniform float detailScale;
      uniform float detailLevel;
      uniform vec4 layerMask;
      varying float vAlpha;
      varying float vStructureKind;
      varying float vShapeSeed;

      void main() {
        float layerVisibility = structureKind < 0.5
          ? layerMask.x
          : structureKind < 2.5
            ? layerMask.y
            : structureKind < 3.5
              ? layerMask.z
              : structureKind < 4.5
                ? layerMask.w
                : layerMask.y;
        float reveal = smoothstep(
          revealThreshold - 0.018,
          revealThreshold + 0.004,
          detailLevel
        );
        vAlpha = pointAlpha * reveal * layerVisibility;
        vStructureKind = structureKind;
        vShapeSeed = shapeSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(2.0, pointSize * pixelRatio * detailScale);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying float vStructureKind;
      varying float vShapeSeed;

      vec3 structureColor(float kind) {
        if (kind < 0.5) return vec3(0.71, 0.68, 1.0);
        if (kind < 1.5) return vec3(0.84, 0.58, 1.0);
        if (kind < 2.5) return vec3(1.0, 0.57, 0.36);
        if (kind < 3.5) return vec3(0.34, 0.84, 0.94);
        if (kind < 4.5) return vec3(0.28, 0.57, 1.0);
        if (kind < 5.5) return vec3(0.56, 0.42, 1.0);
        if (kind < 6.5) return vec3(1.0, 0.72, 0.28);
        return vec3(0.31, 0.86, 0.66);
      }

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        float angle = atan(point.y, point.x);
        float boundaryVariation = sin(angle * 5.0 + vShapeSeed * 6.28318) * 0.055
          + sin(angle * 9.0 - vShapeSeed * 11.0) * 0.028;
        float warpedRadius = radius * (1.0 + boundaryVariation);
        bool isVoid = vStructureKind > 3.5 && vStructureKind < 4.5;
        float silhouetteRadius = isVoid ? warpedRadius : radius;

        if (silhouetteRadius > 1.0) {
          discard;
        }
        vec3 color = structureColor(vStructureKind);
        float alpha;

        if (isVoid) {
          float softInterior = pow(max(0.0, 1.0 - warpedRadius), 1.18);
          float edgeFade = 1.0 - smoothstep(0.48, 1.0, warpedRadius);
          float diffuseBoundary = pow(edgeFade, 1.45);
          float boundaryMix = smoothstep(0.06, 0.94, warpedRadius);
          float mottledInterior = 0.88 + 0.12
            * sin(angle * 4.0 + warpedRadius * 12.0 + vShapeSeed * 17.0);
          vec3 underdensityInterior = vec3(0.075, 0.18, 0.42);
          vec3 diffuseCoolExtent = color * 0.78;
          color = mix(underdensityInterior, diffuseCoolExtent, boundaryMix * 0.82);
          alpha = (softInterior * 0.46 + diffuseBoundary * 0.18) * mottledInterior;
        } else {
          float halo = pow(1.0 - radius, 0.68);
          float core = 1.0 - smoothstep(0.0, 0.26, radius);
          color = mix(color * 0.68, vec3(1.0), core * 0.72);
          alpha = halo;
        }
        gl_FragColor = vec4(color * radiance, alpha * vAlpha * catalogOpacity);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 28.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) discard;
        float ring = 1.0 - smoothstep(0.06, 0.16, abs(radius - 0.7));
        float halo = pow(1.0 - radius, 1.4) * 0.32;
        gl_FragColor = vec4(0.65, 0.88, 1.0, max(ring, halo));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-cosmic-structure';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 6;
  point.userData['objectId'] = null;

  return point;
}

function countStructures(
  types: readonly CosmicStructureType[],
): Partial<Record<CosmicStructureType, number>> {
  const counts: Partial<Record<CosmicStructureType, number>> = {};

  for (const structureType of types) {
    counts[structureType] = (counts[structureType] ?? 0) + 1;
  }

  return counts;
}
