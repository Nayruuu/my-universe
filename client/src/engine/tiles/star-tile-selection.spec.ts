import * as THREE from 'three';
import { type StarTileIndex, type StarTileIndexNode } from '../../data/models/universe.models';
import {
  createStarTileRenderNodes,
  createStarTileView,
  selectStarTileNodeIds,
  type StarTileRenderNode,
  type StarTileView,
} from './star-tile-selection';

describe('sélection spatiale des tuiles stellaires', () => {
  it('ignore les niveaux sans agrégation et filtre les racines hors du frustum', () => {
    const nodes = [renderNode('root-visible', 0, 0, 10), renderNode('root-hidden', 500, 0, 10)];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2 }))).toEqual([]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 4 }))).toEqual(['root-visible']);
  });

  it('raffine les plus grandes cellules visibles selon le budget qualité', () => {
    const nodes = [
      renderNode('root-a', 0, 0, 18, ['a-0', 'a-1']),
      renderNode('root-b', 20, 0, 14, ['b-0']),
      renderNode('root-c', -30, 0, 10, ['c-0']),
      renderNode('a-0', -2, 0, 5, [], 'root-a'),
      renderNode('a-1', 2, 0, 5, [], 'root-a'),
      renderNode('b-0', 20, 0, 5, [], 'root-b'),
      renderNode('c-0', -30, 0, 5, [], 'root-c'),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 3, quality: 'low' }))).toEqual([
      'a-0',
      'a-1',
      'b-0',
      'root-c',
    ]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 3, quality: 'high' }))).toEqual([
      'a-0',
      'a-1',
      'b-0',
      'c-0',
    ]);
  });

  it('conserve une racine trop petite ou sans enfants', () => {
    const nodes = [
      renderNode('small', 0, 0, 0.25, ['small-child']),
      renderNode('leaf', 15, 0, 20),
      renderNode('small-child', 0, 0, 0.1, [], 'small'),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 3, quality: 'high' }))).toEqual([
      'leaf',
      'small',
    ]);
  });

  it('départage de façon stable deux cellules de même taille apparente', () => {
    const nodes = [
      renderNode('root-b', 0, 0, 20, ['b-0']),
      renderNode('root-c', 0, 0, 20, ['c-0']),
      renderNode('root-a', 0, 0, 20, ['a-0']),
      renderNode('a-0', 0, 0, 5, [], 'root-a'),
      renderNode('b-0', 0, 0, 5, [], 'root-b'),
      renderNode('c-0', 0, 0, 5, [], 'root-c'),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 3, quality: 'low' }))).toEqual([
      'a-0',
      'b-0',
      'root-c',
    ]);
  });

  it('applique le floating origin lors du test de visibilité', () => {
    const nodes = [renderNode('shifted', 500, 0, 10)];

    expect(
      selectStarTileNodeIds(
        nodes,
        view({ lodLevel: 4, worldOffset: new THREE.Vector3(-500, 0, 0) }),
      ),
    ).toEqual(['shifted']);
  });

  it('projette les bornes scientifiques et capture une caméra immuable', () => {
    const renderNodes = createStarTileRenderNodes(index(), (position, target) =>
      target.set(position[0] * 2, position[1] * 2, position[2] * 2),
    );
    const root = renderNodes.find((node) => node.id === 'root');

    expect(root?.center.toArray()).toEqual([0, 0, 0]);
    expect(root?.radius).toBeCloseTo(Math.sqrt(12), 8);

    const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 2_000);

    camera.position.set(1, 2, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const snapshot = createStarTileView(camera, 900, 3, 'medium', new THREE.Vector3(4, 5, 6));

    camera.position.set(9, 9, 9);
    expect(snapshot.cameraPosition.toArray()).toEqual([1, 2, 100]);
    expect(snapshot.worldOffset.toArray()).toEqual([4, 5, 6]);
    expect(snapshot.viewportHeight).toBe(900);
    expect(snapshot.projectionScaleY).toBeGreaterThan(1);
  });
});

function renderNode(
  id: string,
  x: number,
  y: number,
  radius: number,
  childIds: readonly string[] = [],
  parentId?: string,
): StarTileRenderNode {
  return {
    id,
    parentId,
    childIds,
    center: new THREE.Vector3(x, y, 0),
    radius,
  };
}

function view(overrides: Partial<StarTileView> = {}): StarTileView {
  return {
    lodLevel: 4,
    quality: 'medium',
    viewportHeight: 1_000,
    projectionScaleY: 1,
    cameraPosition: new THREE.Vector3(0, 0, 100),
    worldOffset: new THREE.Vector3(),
    frustum: cubeFrustum(100),
    ...overrides,
  };
}

function cubeFrustum(halfSize: number): THREE.Frustum {
  return new THREE.Frustum(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfSize),
  );
}

function index(): StarTileIndex {
  const root: StarTileIndexNode = {
    id: 'root',
    lodLevel: 4,
    parentId: undefined,
    childIds: ['child'],
    boundsParsec: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    sourceStarCount: 2,
    clusterCount: 1,
    cellSizeParsec: 160,
    url: '/root.json',
  };
  const child: StarTileIndexNode = {
    id: 'child',
    lodLevel: 3,
    parentId: 'root',
    childIds: [],
    boundsParsec: {
      min: [-1, -1, -1],
      max: [0, 0, 0],
    },
    sourceStarCount: 1,
    clusterCount: 1,
    cellSizeParsec: 40,
    url: '/child.json',
  };

  return {
    version: '2.0.0',
    sourceCatalog: 'fixture',
    sourceStarCount: 2,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'parsec',
    scientificConfidence: 'calculated',
    representation: 'illustrative-aggregation',
    rootIds: ['root'],
    nodes: [root, child],
  };
}
