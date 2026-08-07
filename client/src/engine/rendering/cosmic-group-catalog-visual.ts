import * as THREE from 'three';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  CosmicMapLayers,
  getCosmicGroupRevealThreshold,
  stableMapPriority,
} from './cosmic-map-policy';

const FILAMENT_MAXIMUM_LENGTH_MPC = 52;

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
  const filamentEdgeCount = filamentPairs.length / 2;
  const filamentGeometry = createFilamentGeometry(registry, filamentPairs);
  const pointGeometry = createPointGeometry(registry);
  const filaments = new THREE.LineSegments(filamentGeometry.geometry, createFilamentMaterial());
  const points = new THREE.Points(pointGeometry.geometry, createPointMaterial());
  const selectionPoint = createSelectionPoint();
  const renderIndexByObjectId = new Map<string, number>();

  filaments.name = 'illustrative-cosmicflows4-filaments';
  filaments.visible = false;
  filaments.frustumCulled = false;
  filaments.renderOrder = 0;
  filaments.userData['edgeCount'] = filamentEdgeCount;
  filaments.userData['scientificConfidence'] = 'illustrative';
  filaments.userData['visualStyle'] = 'derived-nearest-neighbor-cosmic-filaments';
  filaments.userData['detailMode'] = 'camera-distance-confidence-fade';
  filaments.userData['source'] = 'Derived from Cosmicflows-4 group positions';
  points.name = 'calculated-cosmicflows4-groups';
  points.visible = false;
  points.frustumCulled = false;
  points.renderOrder = 1;
  points.layers.enable(PICKING_LAYER);
  selectionPoint.layers.enable(PICKING_LAYER);
  points.userData['catalogCount'] = registry.catalog.count;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['appearanceConfidence'] = 'illustrative';
  points.userData['visualStyle'] = 'adaptive-unresolved-group-impostors';
  points.userData['source'] = 'Cosmicflows-4 · Tully et al. (2023)';
  points.userData['visualColorEncoding'] = 'illustrative-distance-gradient-near-warm-far-cool';
  points.userData['objectIds'] = pointGeometry.objectIds;
  points.userData['visibleIndices'] = visibleIndices;
  points.userData['activeCount'] = 0;
  points.userData['layerState'] = { ...layers };
  for (let index = 0; index < pointGeometry.objectIds.length; index += 1) {
    renderIndexByObjectId.set(pointGeometry.objectIds[index]!, index);
  }

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

function createFilamentGeometry(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
): { geometry: THREE.BufferGeometry; revealThresholds: Float32Array } {
  const edgeCount = filamentPairs.length / 2;
  const records: FilamentRenderRecord[] = [];

  for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
    records.push(createFilamentRecord(registry, filamentPairs, edgeIndex));
  }
  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.edgeIndex - right.edgeIndex,
  );
  const positions = new Float32Array(edgeCount * 6);
  const alphas = new Float32Array(edgeCount * 2);
  const detailThresholds = new Float32Array(edgeCount * 2);
  const revealThresholds = new Float32Array(edgeCount);

  for (let renderIndex = 0; renderIndex < records.length; renderIndex += 1) {
    const record = records[renderIndex]!;
    const vertexOffset = renderIndex * 6;
    const alphaOffset = renderIndex * 2;
    const sourceOffset = record.fromIndex * 3;
    const targetOffset = record.toIndex * 3;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), vertexOffset);
    positions.set(
      registry.renderPositions.subarray(targetOffset, targetOffset + 3),
      vertexOffset + 3,
    );
    alphas[alphaOffset] = record.alpha;
    alphas[alphaOffset + 1] = record.alpha;
    detailThresholds[alphaOffset] = record.revealThreshold;
    detailThresholds[alphaOffset + 1] = record.revealThreshold;
    revealThresholds[renderIndex] = record.revealThreshold;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('detailThreshold', new THREE.BufferAttribute(detailThresholds, 1));
  geometry.setDrawRange(0, 0);
  if (edgeCount > 0) {
    geometry.computeBoundingSphere();
  }

  return { geometry, revealThresholds };
}

interface FilamentRenderRecord {
  readonly edgeIndex: number;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly alpha: number;
  readonly revealThreshold: number;
}

function createFilamentRecord(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
  edgeIndex: number,
): FilamentRenderRecord {
  const fromIndex = filamentPairs[edgeIndex * 2]!;
  const toIndex = filamentPairs[edgeIndex * 2 + 1]!;
  const sourceOffset = fromIndex * 3;
  const targetOffset = toIndex * 3;
  const deltaX =
    registry.catalog.positionsMpc[targetOffset]! - registry.catalog.positionsMpc[sourceOffset]!;
  const deltaY =
    registry.catalog.positionsMpc[targetOffset + 1]! -
    registry.catalog.positionsMpc[sourceOffset + 1]!;
  const deltaZ =
    registry.catalog.positionsMpc[targetOffset + 2]! -
    registry.catalog.positionsMpc[sourceOffset + 2]!;
  const distanceMpc = Math.hypot(deltaX, deltaY, deltaZ);
  const strength =
    0.12 + (1 - THREE.MathUtils.clamp(distanceMpc / FILAMENT_MAXIMUM_LENGTH_MPC, 0, 1)) * 0.88;
  const sourceReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[fromIndex]! / 1.2, 0, 1);
  const targetReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[toIndex]! / 1.2, 0, 1);
  const reliability = (sourceReliability + targetReliability) * 0.5;

  return {
    edgeIndex,
    fromIndex,
    toIndex,
    alpha: (0.38 + strength * 0.62) * (0.6 + reliability * 0.4),
    revealThreshold: 0.04 + (1 - (strength * 0.72 + reliability * 0.28)) * 0.72,
  };
}

function createFilamentMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      filamentOpacity: { value: 0 },
      filamentDetail: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float lineAlpha;
      attribute float detailThreshold;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        vAlpha = lineAlpha;
        vDetailThreshold = detailThreshold;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float filamentOpacity;
      uniform float filamentDetail;
      uniform float radiance;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        float detailFade = smoothstep(
          vDetailThreshold - 0.025,
          vDetailThreshold + 0.005,
          filamentDetail
        );
        vec3 color = mix(vec3(0.04, 0.34, 0.72), vec3(0.48, 0.93, 1.0), vAlpha);
        gl_FragColor = vec4(color * radiance, filamentOpacity * vAlpha * detailFade);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createPointGeometry(registry: CosmicGroupCatalogRegistry): {
  geometry: THREE.BufferGeometry;
  objectIds: readonly string[];
  revealThresholds: Float32Array;
} {
  const catalog = registry.catalog;
  const records: GroupRenderRecord[] = Array.from({ length: catalog.count }, (_, catalogIndex) => ({
    catalogIndex,
    objectId: registry.objectIds[catalogIndex]!,
    revealThreshold: getCosmicGroupRevealThreshold(registry.objectIds[catalogIndex]!),
  }));

  if (records.length > 0) {
    records[0]!.revealThreshold = 0;
  }
  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const colors = new Float32Array(catalog.count * 3);
  const revealThresholds = new Float32Array(catalog.count);
  const galaxyAngles = new Float32Array(catalog.count);
  const galaxyAxisRatios = new Float32Array(catalog.count);
  const galaxyProfiles = new Float32Array(catalog.count);
  const galaxyProminences = new Float32Array(catalog.count);
  const galaxySeeds = new Float32Array(catalog.count);
  const objectIds = new Array<string>(catalog.count);
  const nearColor = new THREE.Color(0xffc876);
  const middleColor = new THREE.Color(0xb9e5ff);
  const farColor = new THREE.Color(0x8c78ff);
  const pointColor = new THREE.Color();

  for (let renderIndex = 0; renderIndex < catalog.count; renderIndex += 1) {
    const record = records[renderIndex]!;
    const catalogIndex = record.catalogIndex;
    const sourceOffset = catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const reliability =
      1 - THREE.MathUtils.clamp(catalog.distanceModulusErrors[catalogIndex]! / 1.2, 0, 1);
    const objectId = record.objectId;
    const depth = normalizedLogarithmicDepth(
      catalog.distancesMpc[catalogIndex]!,
      catalog.minimumDistanceMpc,
      catalog.maximumDistanceMpc,
    );
    const prominence = Math.pow(1 - stableMapPriority(`${objectId}:prominence`), 6);

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), renderOffset);
    sizes[renderIndex] = 2.4 + reliability * 5.5 + (1 - depth) * 3 + prominence * 2.4;
    alphas[renderIndex] = 0.3 + reliability * 0.5 + prominence * 0.08;

    if (depth < 0.5) {
      pointColor.lerpColors(nearColor, middleColor, depth * 2);
    } else {
      pointColor.lerpColors(middleColor, farColor, (depth - 0.5) * 2);
    }
    colors[renderOffset] = pointColor.r;
    colors[renderOffset + 1] = pointColor.g;
    colors[renderOffset + 2] = pointColor.b;
    revealThresholds[renderIndex] = record.revealThreshold;
    galaxyAngles[renderIndex] = stableMapPriority(`${objectId}:angle`) * Math.PI * 2;
    galaxyAxisRatios[renderIndex] = 0.28 + stableMapPriority(`${objectId}:axis-ratio`) * 0.68;
    galaxyProfiles[renderIndex] = stableMapPriority(`${objectId}:profile`);
    galaxyProminences[renderIndex] = prominence;
    galaxySeeds[renderIndex] = stableMapPriority(`${objectId}:structure`);
    objectIds[renderIndex] = objectId;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('revealThreshold', new THREE.BufferAttribute(revealThresholds, 1));
  geometry.setAttribute('galaxyAngle', new THREE.BufferAttribute(galaxyAngles, 1));
  geometry.setAttribute('galaxyAxisRatio', new THREE.BufferAttribute(galaxyAxisRatios, 1));
  geometry.setAttribute('galaxyProfile', new THREE.BufferAttribute(galaxyProfiles, 1));
  geometry.setAttribute('galaxyProminence', new THREE.BufferAttribute(galaxyProminences, 1));
  geometry.setAttribute('galaxySeed', new THREE.BufferAttribute(galaxySeeds, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();

  return { geometry, objectIds, revealThresholds };
}

interface GroupRenderRecord {
  readonly catalogIndex: number;
  readonly objectId: string;
  revealThreshold: number;
}

function normalizedLogarithmicDepth(distance: number, minimum: number, maximum: number): number {
  const logarithmicMinimum = Math.log1p(Math.max(0, minimum));
  const logarithmicRange = Math.max(
    0.000_001,
    Math.log1p(Math.max(0, maximum)) - logarithmicMinimum,
  );

  return THREE.MathUtils.clamp(
    (Math.log1p(Math.max(0, distance)) - logarithmicMinimum) / logarithmicRange,
    0,
    1,
  );
}

function createPointMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
      detailLevel: { value: 0 },
      impostorBlend: { value: 0 },
      qualityScale: { value: 1 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute vec3 pointColor;
      attribute float revealThreshold;
      attribute float galaxyAngle;
      attribute float galaxyAxisRatio;
      attribute float galaxyProfile;
      attribute float galaxyProminence;
      attribute float galaxySeed;
      uniform float pixelRatio;
      uniform float detailLevel;
      uniform float impostorBlend;
      uniform float qualityScale;
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vGalaxyOrientation;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;
      varying float vImpostorBlend;

      void main() {
        float reveal = smoothstep(
          revealThreshold - 0.018,
          revealThreshold + 0.004,
          detailLevel
        );
        vAlpha = pointAlpha * reveal;
        vColor = pointColor;
        vGalaxyOrientation = vec2(cos(galaxyAngle), sin(galaxyAngle));
        vGalaxyAxisRatio = galaxyAxisRatio;
        vGalaxyProfile = galaxyProfile;
        vGalaxyProminence = galaxyProminence;
        vGalaxySeed = galaxySeed;
        vImpostorBlend = impostorBlend;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float prominenceScale = 1.0 + galaxyProminence * 1.5;
        float visualScale = mix(1.0, 2.05 * prominenceScale, impostorBlend) * qualityScale;
        gl_PointSize = max(1.0, pointSize * visualScale * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vGalaxyOrientation;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;
      varying float vImpostorBlend;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float circularRadius = length(point);
        if (circularRadius > 1.0) {
          discard;
        }

        vec2 orientedPoint = mat2(
          vGalaxyOrientation.x,
          -vGalaxyOrientation.y,
          vGalaxyOrientation.y,
          vGalaxyOrientation.x
        ) * point;
        float axisRatio = mix(1.0, vGalaxyAxisRatio, vImpostorBlend);
        float galaxyRadius = length(vec2(orientedPoint.x, orientedPoint.y / axisRatio));
        if (vImpostorBlend > 0.99 && galaxyRadius > 1.0) {
          discard;
        }

        float pointHalo = pow(1.0 - circularRadius, 1.35);
        float pointCore = 1.0 - smoothstep(0.0, 0.24, circularRadius);
        float pointGlow = pointHalo * 0.62 + pointCore;

        float softEdge = 1.0 - smoothstep(0.72, 1.0, galaxyRadius);
        float diffuseLight = exp(-3.35 * galaxyRadius);
        float ellipticalLight = exp(-2.45 * pow(max(galaxyRadius, 0.0001), 0.72));
        float profileMix = smoothstep(0.34, 0.72, vGalaxyProfile);
        float unresolvedGroupLight = mix(ellipticalLight, diffuseLight, profileMix);
        float luminousCore = exp(-16.0 * galaxyRadius) *
          (1.0 + vGalaxyProminence * 0.8);
        vec2 groupLobeOffset = vec2(mix(0.2, 0.38, vGalaxySeed), -0.12);
        float groupLobe = exp(-18.0 * length(
          vec2(orientedPoint.x - groupLobeOffset.x, orientedPoint.y - groupLobeOffset.y)
        ));
        float galaxyGlow = softEdge *
          (unresolvedGroupLight * 0.78 + luminousCore * 1.55 + groupLobe * 0.2) *
          (1.12 + vGalaxyProminence * 0.38);
        float glow = mix(pointGlow, galaxyGlow, vImpostorBlend);

        vec3 coolStarlight = vec3(0.52, 0.7, 1.0);
        vec3 warmStarlight = vec3(1.0, 0.56, 0.3);
        vec3 galaxyColor = mix(coolStarlight, warmStarlight, vGalaxySeed);
        galaxyColor = mix(vColor, galaxyColor, 0.72);
        galaxyColor = mix(galaxyColor, vec3(1.0, 0.92, 0.78), luminousCore * 0.58);
        vec3 pointColor = mix(vColor, vec3(1.0, 0.97, 0.9), pointCore * 0.88);
        vec3 color = mix(pointColor, galaxyColor, vImpostorBlend);
        float brightness = mix(
          0.72 + pointCore * 0.58,
          0.82 + luminousCore * 0.72 + vGalaxyProminence * 0.16,
          vImpostorBlend
        );
        gl_FragColor = vec4(
          color * radiance * brightness,
          vAlpha * catalogOpacity * glow
        );
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
    },
    vertexShader: `
      uniform float pixelRatio;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 24.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.07, 0.18, abs(radius - 0.68));
        float halo = pow(1.0 - radius, 1.5) * 0.38;
        gl_FragColor = vec4(0.52, 0.82, 1.0, max(ring, halo));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-cosmicflows4-group';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.userData['objectId'] = null;

  return point;
}
