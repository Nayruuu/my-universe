import * as THREE from 'three';
import { type GraphicQuality, type StarClusterTile } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { colorIndexToRgb } from '../materials/star-color';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';

interface ClusterRepresentation {
  readonly signature: string;
  readonly lodLevel: number;
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
  readonly starCount: number;
}

const QUALITY_FRACTIONS = {
  low: 0.45,
  medium: 0.72,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

const LOD_OPACITIES = {
  3: 0,
  4: 0,
} as const satisfies Record<number, number>;

export class StarClusterBatch {
  public readonly root = new THREE.Group();

  private readonly representations = new Map<string, ClusterRepresentation>();
  private activeSignatures: readonly string[] = [];
  private quality: GraphicQuality = 'medium';
  private pixelRatio = 1;
  private radiance = 1;

  constructor(private readonly registry: StarCatalogRegistry) {
    this.root.name = 'hyg-star-cluster-root';
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

  public updateLod(lodLevel: number, deltaSeconds: number): void {
    const aggregatedView = lodLevel === 3;
    const retired: string[] = [];

    for (const representation of this.representations.values()) {
      const targetOpacity =
        aggregatedView && !representation.retiring
          ? (LOD_OPACITIES[representation.lodLevel as keyof typeof LOD_OPACITIES] ?? 0)
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
    return 0;
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
      activeRepresentationCount === 0 ? 1 : Math.max(2, activeRepresentationCount);
    const retiringRepresentations = [...this.representations.values()].filter(
      (representation) => representation.retiring,
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
      colorIndex: tile.colorIndicesBv[index]!,
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

  records.forEach((record, index) => {
    const offset = index * 3;
    const color = colorIndexToRgb(record.colorIndex);
    const brightness = THREE.MathUtils.clamp((5 - record.magnitude) / 8, 0, 1);

    registry.toRenderPosition(record.position, renderPosition);
    renderPosition.toArray(positions, offset);
    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    sizes[index] = 3 + Math.min(8, Math.log2(record.starCount + 1) * 1.25) + brightness * 2;
    alphas[index] = 0.42 + brightness * 0.4;
  });
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, records.length);
  geometry.computeBoundingSphere();

  const points = new THREE.Points(geometry, createMaterial());

  points.name = `calculated-hyg-star-clusters-lod-${lodLevel}`;
  points.visible = false;
  points.renderOrder = 1;
  points.userData['tileIds'] = tiles.map((tile) => tile.id);
  points.userData['sourceStarCount'] = tiles.reduce(
    (total, tile) => total + tile.sourceStarCount,
    0,
  );
  points.userData['clusterCount'] = records.length;
  points.userData['scientificConfidence'] = 'calculated';
  points.userData['visualScale'] = 'illustrative-aggregation';

  return points;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      clusterOpacity: { value: 0 },
      radiance: { value: 1 },
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

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = 1.0 - smoothstep(0.18, 1.0, radius);
        float core = 1.0 - smoothstep(0.0, 0.24, radius);
        float alpha = max(halo * 0.72, core) * starAlpha * clusterOpacity;
        gl_FragColor = vec4(starColor * radiance, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function disposePoints(points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>): void {
  points.geometry.dispose();
  points.material.dispose();
}
