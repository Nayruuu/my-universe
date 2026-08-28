import * as THREE from 'three';
import {
  type GraphicQuality,
  type GaiaPresentationStats,
  type StarClusterTile,
  type StarColorIndexSystem,
  type StarTilePointRepresentation,
} from '../../data/models/universe.models';
import {
  calculateStellarNeighborhoodReveal,
  STELLAR_NEIGHBORHOOD_EXPANSION_END,
} from '../coordinates/stellar-neighborhood-scale-model';
import { MILKY_WAY_TRANSITION_END, MILKY_WAY_TRANSITION_START } from '../lod/milky-way-transition';
import { dampValue } from '../lod/screen-space-lod';
import { stellarColorIndexToRgb } from '../materials/star-color';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { isStarTileNavigationLodLevel } from '../tiles/star-tile-selection';

interface ClusterRepresentation {
  readonly signature: string;
  readonly lodLevel: number;
  readonly pointRepresentation: StarTilePointRepresentation;
  readonly tileIds: readonly string[];
  readonly clusterCount: number;
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  opacity: number;
  retiring: boolean;
}

interface ClusterRecord {
  readonly position: readonly [number, number, number];
  readonly magnitude: number;
  readonly colorIndex: number;
  readonly colorIndexSystem: StarColorIndexSystem;
  readonly starCount: number;
}

const QUALITY_FRACTIONS = {
  low: 0.45,
  medium: 0.72,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

const REPRESENTATION_OPACITIES = {
  'aggregate-cell': 0.18,
  'sampled-source': 0.96,
} as const satisfies Record<StarTilePointRepresentation, number>;
const GALACTIC_OVERVIEW_AGGREGATE_OPACITY = 0.035;
const LOCAL_GROUP_AGGREGATE_OPACITY = 0.012;
const GALACTIC_OVERVIEW_STABLE_FADE_END = 6_200;

const GAIA_SAMPLE_FAINT_MAGNITUDE = 12;

export class StarClusterBatch {
  public readonly root = new THREE.Group();

  private readonly representations = new Map<string, ClusterRepresentation>();
  private activeSignatures: readonly string[] = [];
  private quality: GraphicQuality = 'medium';
  private pixelRatio = 1;
  private radiance = 1;

  constructor(private readonly registry: StarCatalogRegistry) {
    this.root.name = 'dense-star-cluster-root';
  }

  public synchronizeTiles(tiles: readonly StarClusterTile[]): boolean {
    const groups = groupTilesByLod(tiles);
    const desiredSignatures = [...groups.entries()]
      .map(([lodLevel, levelTiles]) => signatureFor(lodLevel, levelTiles))
      .sort();
    const changed = !sameSignatures(this.activeSignatures, desiredSignatures);

    if (!changed) {
      return false;
    }

    for (const representation of this.representations.values()) {
      representation.retiring = !desiredSignatures.includes(representation.signature);
    }
    for (const [lodLevel, levelTiles] of groups) {
      const signature = signatureFor(lodLevel, levelTiles);
      const existing = this.representations.get(signature);

      if (existing) {
        existing.retiring = false;
        continue;
      }
      const representation = createRepresentation(signature, lodLevel, levelTiles, this.registry);

      this.representations.set(signature, representation);
      this.root.add(representation.points);
      this.applyPixelRatio(representation);
      this.applyQuality(representation);
      this.applyPhotographicRadiance(representation);
    }
    this.activeSignatures = desiredSignatures;
    this.pruneRetiringRepresentations(desiredSignatures.length);

    return true;
  }

  public setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = Math.max(0.5, pixelRatio);
    for (const representation of this.representations.values()) {
      this.applyPixelRatio(representation);
    }
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    for (const representation of this.representations.values()) {
      this.applyQuality(representation);
    }
  }

  public setPhotographicRadiance(radiance: number): void {
    this.radiance = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    for (const representation of this.representations.values()) {
      this.applyPhotographicRadiance(representation);
    }
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    cameraDistance = defaultCameraDistanceFor(lodLevel),
  ): void {
    const hierarchyVisible = isStarTileNavigationLodLevel(lodLevel);
    const retired: string[] = [];

    for (const representation of this.representations.values()) {
      const targetOpacity =
        hierarchyVisible && !representation.retiring
          ? opacityFor(representation, lodLevel, cameraDistance)
          : 0;

      representation.opacity = dampValue(representation.opacity, targetOpacity, 6, deltaSeconds);
      representation.points.material.uniforms['clusterOpacity']!.value = representation.opacity;
      representation.points.visible =
        representation.points.geometry.drawRange.count > 0 && representation.opacity > 0.004;

      if (representation.retiring && representation.opacity <= 0.004) {
        retired.push(representation.signature);
      }
    }

    for (const signature of retired) {
      const representation = this.representations.get(signature)!;

      this.root.remove(representation.points);
      disposePoints(representation.points);
      this.representations.delete(signature);
    }
  }

  public get activeTileCount(): number {
    return this.activeSignatures.reduce(
      (total, signature) => total + (this.representations.get(signature)?.tileIds.length ?? 0),
      0,
    );
  }

  public get representationCount(): number {
    return this.representations.size;
  }

  public get visibleClusterCount(): number {
    return [...this.representations.values()].reduce(
      (total, representation) =>
        total +
        (representation.points.visible ? representation.points.geometry.drawRange.count : 0),
      0,
    );
  }

  public getPresentationStats(camera: THREE.Camera): GaiaPresentationStats {
    let sampledSources = 0;
    let projectedSampledSources = 0;
    let aggregateCells = 0;
    let projectedAggregateCells = 0;

    for (const representation of this.representations.values()) {
      if (!representation.points.visible) {
        continue;
      }
      const pointCount = representation.points.geometry.drawRange.count;
      const projectedPointCount = countProjectedPoints(representation.points, camera);

      if (representation.pointRepresentation === 'sampled-source') {
        sampledSources += pointCount;
        projectedSampledSources += projectedPointCount;
      } else {
        aggregateCells += pointCount;
        projectedAggregateCells += projectedPointCount;
      }
    }

    return {
      sampledSources,
      projectedSampledSources,
      aggregateCells,
      projectedAggregateCells,
    };
  }

  public dispose(): void {
    for (const representation of this.representations.values()) {
      disposePoints(representation.points);
    }
    this.representations.clear();
    this.activeSignatures = [];
    this.root.clear();
  }

  private applyPixelRatio(representation: ClusterRepresentation): void {
    representation.points.material.uniforms['pixelRatio']!.value = this.pixelRatio;
  }

  private applyQuality(representation: ClusterRepresentation): void {
    const count = Math.max(
      1,
      Math.round(representation.clusterCount * QUALITY_FRACTIONS[this.quality]),
    );

    representation.points.geometry.setDrawRange(0, count);
  }

  private applyPhotographicRadiance(representation: ClusterRepresentation): void {
    representation.points.material.uniforms['radiance']!.value = this.radiance;
  }

  private pruneRetiringRepresentations(activeRepresentationCount: number): void {
    const maximumRepresentationCount =
      activeRepresentationCount === 0 ? 1 : activeRepresentationCount + 1;
    const activeRepresentationTypes = new Set(
      [...this.representations.values()]
        .filter((representation) => !representation.retiring)
        .map((representation) => representation.pointRepresentation),
    );
    const retiringRepresentations = [...this.representations.values()].filter(
      (representation) => representation.retiring,
    );

    retiringRepresentations.sort(
      (left, right) =>
        Number(activeRepresentationTypes.has(right.pointRepresentation)) -
        Number(activeRepresentationTypes.has(left.pointRepresentation)),
    );

    while (
      this.representations.size > maximumRepresentationCount &&
      retiringRepresentations.length > 0
    ) {
      const representation = retiringRepresentations.shift()!;

      this.root.remove(representation.points);
      disposePoints(representation.points);
      this.representations.delete(representation.signature);
    }
  }
}

function opacityFor(
  representation: ClusterRepresentation,
  navigationLodLevel: number,
  cameraDistance: number,
): number {
  if (navigationLodLevel === 2) {
    const reveal = calculateStellarNeighborhoodReveal(cameraDistance);

    if (representation.lodLevel === 3 && representation.pointRepresentation === 'sampled-source') {
      return REPRESENTATION_OPACITIES['sampled-source'] * reveal;
    }
    if (representation.lodLevel === 4 && representation.pointRepresentation === 'aggregate-cell') {
      return REPRESENTATION_OPACITIES['aggregate-cell'] * reveal;
    }
  }
  if (
    (navigationLodLevel === 3 || navigationLodLevel === 4) &&
    representation.lodLevel === 4 &&
    representation.pointRepresentation === 'aggregate-cell'
  ) {
    const overviewOpacity = THREE.MathUtils.lerp(
      GALACTIC_OVERVIEW_AGGREGATE_OPACITY,
      LOCAL_GROUP_AGGREGATE_OPACITY,
      smoothstep(MILKY_WAY_TRANSITION_START, MILKY_WAY_TRANSITION_END, cameraDistance),
    );
    const stableTransformPresence = smoothstep(
      STELLAR_NEIGHBORHOOD_EXPANSION_END,
      GALACTIC_OVERVIEW_STABLE_FADE_END,
      cameraDistance,
    );

    return overviewOpacity * stableTransformPresence;
  }

  return 0;
}

function defaultCameraDistanceFor(lodLevel: number): number {
  if (lodLevel === 3) {
    return MILKY_WAY_TRANSITION_START;
  }
  if (lodLevel === 4) {
    return MILKY_WAY_TRANSITION_END;
  }

  return 0;
}

function groupTilesByLod(
  tiles: readonly StarClusterTile[],
): ReadonlyMap<number, readonly StarClusterTile[]> {
  const groups = new Map<number, StarClusterTile[]>();

  for (const tile of tiles) {
    const group = groups.get(tile.lodLevel) ?? [];

    group.push(tile);
    groups.set(tile.lodLevel, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
  }

  return groups;
}

function signatureFor(lodLevel: number, tiles: readonly StarClusterTile[]): string {
  return `${lodLevel}:${tiles.map((tile) => tile.id).join(',')}`;
}

function sameSignatures(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((signature, index) => signature === right[index])
  );
}

function createRepresentation(
  signature: string,
  lodLevel: number,
  tiles: readonly StarClusterTile[],
  registry: StarCatalogRegistry,
): ClusterRepresentation {
  const records = tiles
    .flatMap((tile) => recordsFromTile(tile))
    .sort((left, right) => left.magnitude - right.magnitude);
  const points = createClusterPoints(records, lodLevel, tiles, registry);

  return {
    signature,
    lodLevel,
    pointRepresentation: tiles[0]!.representation,
    tileIds: tiles.map((tile) => tile.id),
    clusterCount: records.length,
    points,
    opacity: 0,
    retiring: false,
  };
}

function recordsFromTile(tile: StarClusterTile): readonly ClusterRecord[] {
  return Array.from({ length: tile.clusterCount }, (_, index) => {
    const offset = index * 3;

    return {
      position: [
        tile.positionsParsec[offset]!,
        tile.positionsParsec[offset + 1]!,
        tile.positionsParsec[offset + 2]!,
      ],
      magnitude: tile.apparentMagnitudes[index]!,
      colorIndex: tile.colorIndices[index]!,
      colorIndexSystem: tile.colorIndexSystem,
      starCount: tile.starCounts[index]!,
    };
  });
}

function createClusterPoints(
  records: readonly ClusterRecord[],
  lodLevel: number,
  tiles: readonly StarClusterTile[],
  registry: StarCatalogRegistry,
): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const positions = new Float32Array(records.length * 3);
  const colors = new Float32Array(records.length * 3);
  const sizes = new Float32Array(records.length);
  const alphas = new Float32Array(records.length);
  const renderPosition = new THREE.Vector3();
  const pointRepresentation = tiles[0]!.representation;

  records.forEach((record, index) => {
    const offset = index * 3;
    const color = stellarColorIndexToRgb(record.colorIndex, record.colorIndexSystem);
    const aggregateBrightness = THREE.MathUtils.clamp((5 - record.magnitude) / 8, 0, 1);
    const density = THREE.MathUtils.clamp(Math.log2(record.starCount + 1) / 11, 0, 1);
    const sampledBrightness = Math.pow(
      THREE.MathUtils.clamp(
        (GAIA_SAMPLE_FAINT_MAGNITUDE - record.magnitude) / GAIA_SAMPLE_FAINT_MAGNITUDE,
        0,
        1,
      ),
      0.72,
    );

    registry.toRenderPosition(record.position, renderPosition);
    renderPosition.toArray(positions, offset);
    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    if (pointRepresentation === 'sampled-source') {
      sizes[index] = 0.9 + sampledBrightness + density * 0.1;
      alphas[index] = 0.5 + sampledBrightness * 0.42 + density * 0.08;
    } else {
      sizes[index] = 1.1 + density * 1.45 + aggregateBrightness * 0.35;
      alphas[index] = 0.22 + density * 0.22 + aggregateBrightness * 0.18;
    }
  });
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, records.length);
  geometry.computeBoundingSphere();

  const points = new THREE.Points(geometry, createMaterial(pointRepresentation));
  const sourceTile = tiles[0]!;

  points.name =
    pointRepresentation === 'sampled-source'
      ? `calculated-dense-star-samples-lod-${lodLevel}`
      : `calculated-dense-star-clusters-lod-${lodLevel}`;
  points.visible = false;
  points.renderOrder = 1;
  points.userData['tileIds'] = tiles.map((tile) => tile.id);
  points.userData['sourceStarCount'] = tiles.reduce(
    (total, tile) => total + tile.sourceStarCount,
    0,
  );
  points.userData['clusterCount'] = records.length;
  points.userData['pointRepresentation'] = pointRepresentation;
  points.userData['sourceCatalog'] = sourceTile.sourceCatalog;
  points.userData['magnitudeBand'] = sourceTile.magnitudeBand;
  points.userData['colorIndexSystem'] = sourceTile.colorIndexSystem;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['visualScale'] =
    pointRepresentation === 'sampled-source'
      ? 'measured-source-sample'
      : 'illustrative-aggregation';
  points.userData['visualStyle'] = 'gaia-photometry-with-cool-catalog-halo';

  return points;
}

function createMaterial(pointRepresentation: StarTilePointRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      clusterOpacity: { value: 0 },
      radiance: { value: 1 },
      sampledSource: { value: pointRepresentation === 'sampled-source' ? 1 : 0 },
      catalogSignature: { value: pointRepresentation === 'sampled-source' ? 0.14 : 0.22 },
      catalogTint: { value: new THREE.Color(0x9fbdff) },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      varying vec3 starColor;
      varying float starAlpha;
      uniform float pixelRatio;

      void main() {
        starColor = color;
        starAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      varying vec3 starColor;
      varying float starAlpha;
      uniform float clusterOpacity;
      uniform float radiance;
      uniform float sampledSource;
      uniform float catalogSignature;
      uniform vec3 catalogTint;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = 1.0 - smoothstep(0.18, 1.0, radius);
        float core = 1.0 - smoothstep(0.0, 0.24, radius);
        float haloStrength = mix(0.58, 0.28, sampledSource);
        float alpha = max(halo * haloStrength, core) * starAlpha * clusterOpacity;
        float signatureStrength = catalogSignature * (1.0 - core * 0.62);
        vec3 catalogColor = mix(starColor, catalogTint, signatureStrength);
        vec3 coreColor = mix(catalogColor, vec3(1.0), core * sampledSource * 0.52);
        float luminosity = 0.86 + core * sampledSource * 0.64;
        gl_FragColor = vec4(coreColor * radiance * luminosity, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}

function disposePoints(points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>): void {
  points.geometry.dispose();
  points.material.dispose();
}

function countProjectedPoints(
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>,
  camera: THREE.Camera,
): number {
  const positions = points.geometry.getAttribute('position');
  const drawStart = Math.max(0, points.geometry.drawRange.start);
  const drawCount = Math.min(
    positions.count - drawStart,
    Math.max(0, points.geometry.drawRange.count),
  );
  const projected = new THREE.Vector3();
  let projectedCount = 0;

  points.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  for (let index = drawStart; index < drawStart + drawCount; index += 1) {
    projected.fromBufferAttribute(positions, index);
    points.localToWorld(projected);
    projected.project(camera);
    if (
      Math.abs(projected.x) <= 1 &&
      Math.abs(projected.y) <= 1 &&
      projected.z >= -1 &&
      projected.z <= 1
    ) {
      projectedCount += 1;
    }
  }

  return projectedCount;
}
