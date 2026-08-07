import * as THREE from 'three';
import {
  type ConstellationCatalog,
  type ConstellationFigure,
  type SpaceObject,
} from '../../data/models/universe.models';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const CONSTELLATION_ID_PREFIX = 'constellation-';

interface FigureGeometry {
  readonly objectId: string;
  readonly figure: ConstellationFigure;
  readonly vertexOffset: number;
  readonly vertexCount: number;
  readonly center: THREE.Vector3;
  readonly radius: number;
  readonly brightestMagnitude: number;
  readonly starCount: number;
}

export class ConstellationVisual {
  public readonly root = new THREE.Group();
  public readonly lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly highlightLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  public readonly definitions: readonly SpaceObject[];

  private readonly figuresById: ReadonlyMap<string, FigureGeometry>;
  private readonly definitionsById: ReadonlyMap<string, SpaceObject>;

  constructor(catalog: ConstellationCatalog, registry: StarCatalogRegistry) {
    const { geometry, figures } = createGeometry(catalog, registry);
    const interactionMetadata = createInteractionMetadata(figures);
    const labelRanks = rankFigures(figures);

    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x83b9d8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.highlightLines = new THREE.LineSegments(
      createHighlightGeometry(figures),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.figuresById = new Map(figures.map((figure) => [figure.objectId, figure]));
    this.definitions = figures.map((figure) =>
      createDefinition(figure, catalog, labelRanks.get(figure.objectId)!),
    );
    this.definitionsById = new Map(
      this.definitions.map((definition) => [definition.id, definition]),
    );

    this.configureSceneObjects(catalog, interactionMetadata);
  }

  public has(objectId: string): boolean {
    return this.figuresById.has(objectId);
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    return this.definitionsById.get(objectId);
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const figure = this.figuresById.get(objectId);

    if (!figure) {
      return null;
    }
    this.root.updateWorldMatrix(true, false);

    return target.copy(figure.center).applyMatrix4(this.root.matrixWorld);
  }

  public getFocusRadius(objectId: string): number | null {
    return this.figuresById.get(objectId)?.radius ?? null;
  }

  public showHighlight(objectId: string | null): void {
    const figure = objectId ? this.figuresById.get(objectId) : undefined;

    if (!figure) {
      this.highlightLines.geometry.setDrawRange(0, 0);
      this.highlightLines.userData['objectId'] = null;
      this.highlightLines.visible = false;

      return;
    }
    const source = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const target = this.highlightLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sourceValues = source.array as Float32Array;
    const targetValues = target.array as Float32Array;
    const start = figure.vertexOffset * 3;
    const end = start + figure.vertexCount * 3;

    targetValues.set(sourceValues.subarray(start, end));
    target.needsUpdate = true;
    this.highlightLines.geometry.setDrawRange(0, figure.vertexCount);
    this.highlightLines.userData['objectId'] = figure.objectId;
  }

  public dispose(): void {
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    this.highlightLines.geometry.dispose();
    this.highlightLines.material.dispose();
    this.root.clear();
  }

  private configureSceneObjects(
    catalog: ConstellationCatalog,
    interactionMetadata: ReturnType<typeof createInteractionMetadata>,
  ): void {
    this.root.name = 'constellation-lines-root';
    this.lines.name = 'illustrative-constellation-lines';
    this.lines.layers.enable(PICKING_LAYER);
    this.lines.visible = false;
    this.lines.renderOrder = 1;
    this.lines.userData['figureCount'] = catalog.figures.length;
    this.lines.userData['segmentCount'] = this.lines.geometry.getAttribute('position').count / 2;
    this.lines.userData['scientificConfidence'] = catalog.scientificConfidence;
    this.lines.userData['referenceFrame'] = catalog.referenceFrame;
    this.lines.userData['source'] = catalog.source.name;
    this.lines.userData['objectIds'] = interactionMetadata.objectIds;
    this.lines.userData['visibleIndices'] = interactionMetadata.visibleIndices;
    this.highlightLines.name = 'highlighted-constellation-lines';
    this.highlightLines.visible = false;
    this.highlightLines.renderOrder = 2;
    this.highlightLines.userData['objectId'] = null;
    this.highlightLines.userData['scientificConfidence'] = catalog.scientificConfidence;
    this.highlightLines.userData['visualStyle'] = 'additive-target-highlight';
    this.root.add(this.lines, this.highlightLines);
  }
}

function createGeometry(
  catalog: ConstellationCatalog,
  registry: StarCatalogRegistry,
): { geometry: THREE.BufferGeometry; figures: FigureGeometry[] } {
  const segmentCount = catalog.figures.reduce((total, figure) => total + figure.segments.length, 0);
  const positions = new Float32Array(segmentCount * 6);
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const figures: FigureGeometry[] = [];
  let offset = 0;

  for (const figure of catalog.figures) {
    const firstVertex = offset / 3;
    const uniquePositions = new Map<number, THREE.Vector3>();

    for (const [fromId, toId] of figure.segments) {
      requirePosition(registry, fromId, figure.id, from);
      requirePosition(registry, toId, figure.id, to);
      positions.set(from.toArray(), offset);
      positions.set(to.toArray(), offset + 3);
      uniquePositions.set(fromId, from.clone());
      uniquePositions.set(toId, to.clone());
      offset += 6;
    }
    figures.push(
      createFigureGeometry(
        figure,
        firstVertex,
        offset / 3 - firstVertex,
        uniquePositions,
        registry,
      ),
    );
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();

  return { geometry, figures };
}

function requirePosition(
  registry: StarCatalogRegistry,
  catalogId: number,
  figureId: string,
  target: THREE.Vector3,
): void {
  const position = registry.getLocalPosition(`hyg-${catalogId}`, target);

  if (!position) {
    throw new Error(`Étoile HYG ${catalogId} introuvable pour le tracé de ${figureId}.`);
  }
}

function createFigureGeometry(
  figure: ConstellationFigure,
  vertexOffset: number,
  vertexCount: number,
  uniquePositions: ReadonlyMap<number, THREE.Vector3>,
  registry: StarCatalogRegistry,
): FigureGeometry {
  const center = new THREE.Vector3();

  for (const position of uniquePositions.values()) {
    center.add(position);
  }
  center.multiplyScalar(1 / uniquePositions.size);
  let radius = 0;
  let brightestMagnitude = Number.POSITIVE_INFINITY;

  for (const [catalogId, position] of uniquePositions) {
    radius = Math.max(radius, center.distanceTo(position));
    const index = registry.getIndex(`hyg-${catalogId}`)!;

    brightestMagnitude = Math.min(brightestMagnitude, registry.catalog.apparentMagnitudes[index]!);
  }

  return {
    objectId: `${CONSTELLATION_ID_PREFIX}${figure.id}`,
    figure,
    vertexOffset,
    vertexCount,
    center,
    radius: Math.max(radius, 0.25),
    brightestMagnitude,
    starCount: uniquePositions.size,
  };
}

function createHighlightGeometry(figures: readonly FigureGeometry[]): THREE.BufferGeometry {
  const maximumVertexCount = Math.max(...figures.map((figure) => figure.vertexCount));
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(maximumVertexCount * 3), 3),
  );
  geometry.setDrawRange(0, 0);

  return geometry;
}

function createInteractionMetadata(figures: readonly FigureGeometry[]): {
  objectIds: string[];
  visibleIndices: Uint8Array;
} {
  const vertexCount = figures.reduce((count, figure) => count + figure.vertexCount, 0);
  const objectIds = new Array<string>(vertexCount);
  const visibleIndices = new Uint8Array(vertexCount);

  for (const figure of figures) {
    objectIds.fill(figure.objectId, figure.vertexOffset, figure.vertexOffset + figure.vertexCount);
  }
  visibleIndices.fill(1);

  return { objectIds, visibleIndices };
}

function rankFigures(figures: readonly FigureGeometry[]): ReadonlyMap<string, number> {
  const ranked = [...figures].sort(
    (left, right) =>
      left.brightestMagnitude - right.brightestMagnitude ||
      left.figure.name.localeCompare(right.figure.name),
  );

  return new Map(ranked.map((figure, index) => [figure.objectId, index]));
}

function createDefinition(
  figure: FigureGeometry,
  catalog: ConstellationCatalog,
  labelRank: number,
): SpaceObject {
  return {
    id: figure.objectId,
    name: figure.figure.name,
    aliases: [figure.figure.abbreviation],
    type: 'region',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'illustrative',
    description:
      'Figure conventionnelle reliant des étoiles du catalogue HYG. Les segments aident à reconnaître la constellation mais ne constituent pas une structure physique.',
    referenceEpoch: 2_451_545,
    visual: {
      color: '#83b9d8',
      visualRadius: figure.radius,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'procedural',
      generatorId: 'constellation-centroid',
      seed: labelRank + 1,
    },
    metadata: {
      source: `${catalog.source.name} · ${catalog.source.license}`,
      sourceUrl: catalog.source.url,
      abbreviation: figure.figure.abbreviation,
      constellationId: figure.figure.id,
      constellationLabelRank: labelRank,
      segmentCount: figure.figure.segments.length,
      starCount: figure.starCount,
      keywords: `constellation figure céleste ${figure.figure.abbreviation}`,
      visualAdaptation: 'Segments conventionnels cadrés autour de leur centre visuel',
    },
  };
}
