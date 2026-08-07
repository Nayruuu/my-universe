import * as THREE from 'three';
import { type StarTileIndex, type StarTileIndexNode } from '../../data/models/universe.models';
import { prepareCatalogIncrementally } from '../core/catalog-preparation';
import {
  createStarTileRenderNodes,
  createStarTileView,
  prepareStarTileRenderNodes,
  selectStarTileNodeIds,
  selectVisibleStarTileRootNodeIds,
  type StarTileRenderNode,
  type StarTileView,
} from './star-tile-selection';

describe('sélection spatiale des tuiles stellaires', () => {
  it.each([0, 1, 127, 128, 129, 513])(
    'prépare %i volumes par lots en conservant ordre, bornes et sélection',
    async (count) => {
      const base = index();
      const nodes = Array.from({ length: count }, (_, offset): StarTileIndexNode => ({
        ...base.nodes[offset % 2]!,
        id: `node-${offset}`,
        parentId: offset % 2 === 0 ? undefined : `node-${offset - 1}`,
        childIds: offset % 2 === 0 && offset + 1 < count ? [`node-${offset + 1}`] : [],
        boundsParsec: { min: [offset - 15, -2, -3], max: [offset - 5, 3, 7] },
      }));
      const data = { ...base, nodes };
      const project = (position: readonly [number, number, number], target: THREE.Vector3) =>
        target.set(position[0] * 2, position[1] * 3, position[2] * 4);
      const projected = vi.fn(project);
      let pauses = 0;
      const result = await prepareCatalogIncrementally(
        prepareStarTileRenderNodes(data, projected),
        async () => {
          pauses += 1;
          expect(projected).toHaveBeenCalledTimes(pauses * 128 * 27);
        },
      );

      expect(pauses).toBe(Math.floor(count / 128));
      expect(projected).toHaveBeenCalledTimes(count * 27);
      expect(result).toEqual(createStarTileRenderNodes(data, project));
      expect(data.nodes).toBe(nodes);
      for (let offset = 0; offset < count; offset += 1) {
        expect(result[offset]!.center.toArray()).toEqual([offset * 2 - 20, 1.5, 8]);
        expect(result[offset]!.radius).toBe(Math.sqrt(20 ** 2 + 15 ** 2 + 40 ** 2) / 2);
        expect(result[offset]!.childIds).toBe(nodes[offset]!.childIds);
      }
      for (const quality of ['low', 'medium', 'high'] as const) {
        for (const lodLevel of [0, 1, 2, 3, 4, 5]) {
          const snapshot = view({ quality, lodLevel });

          expect(selectStarTileNodeIds(result, snapshot)).toEqual(
            selectStarTileNodeIds(createStarTileRenderNodes(data, project), snapshot),
          );
        }
      }
    },
  );

  it('conserve les échantillons intérieurs d’une projection non linéaire', async () => {
    const nodes = await prepareCatalogIncrementally(
      prepareStarTileRenderNodes(index(), ([x, y, z], target) => target.set(1 - x * x, y * y, z)),
      async () => undefined,
    );

    expect(nodes[0]!.center.toArray()).toEqual([0.5, 0.5, 0]);
    expect(nodes[0]!.radius).toBe(Math.sqrt(6) / 2);
    expect(nodes[1]!.center).not.toBe(nodes[0]!.center);
    nodes[1]!.center.set(100, 100, 100);
    expect(nodes[0]!.center.toArray()).toEqual([0.5, 0.5, 0]);
  });

  it.each([1, 2])('arrête les projections si la pause %i échoue', async (cancelAt) => {
    const data = { ...index(), nodes: Array.from({ length: 300 }, () => index().nodes[0]!) };
    const project = vi.fn((position: readonly [number, number, number], target: THREE.Vector3) =>
      target.fromArray(position),
    );
    const error = new Error('interrompu');
    let pauses = 0;
    const published = vi.fn();
    const pending = prepareCatalogIncrementally(
      prepareStarTileRenderNodes(data, project),
      async () => {
        pauses += 1;
        if (pauses === cancelAt) {
          throw error;
        }
      },
    ).then(published);

    await expect(pending).rejects.toBe(error);
    expect(project).toHaveBeenCalledTimes(cancelAt * 128 * 27);
    expect(published).not.toHaveBeenCalled();
  });

  it('garde une couverture agrégée à 360° en vue détaillée et filtre l’aperçu galactique', () => {
    const nodes = [renderNode('root-visible', 0, 0, 10), renderNode('root-hidden', 500, 0, 10)];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 3 }))).toEqual(['root-visible']);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 4 }))).toEqual(['root-visible']);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2 }))).toEqual([
      'root-hidden',
      'root-visible',
    ]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 1 }))).toEqual([
      'root-hidden',
      'root-visible',
    ]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 0 }))).toEqual([]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 5 }))).toEqual([]);
  });

  it('remplace les sources détaillées par leur racine dans la Voie lactée', () => {
    const nodes = [
      renderNode('root', 0, 0, 18, ['child']),
      renderNode('child', 0, 0, 5, [], 'root'),
    ];

    expect(
      selectStarTileNodeIds(
        nodes,
        view({ lodLevel: 1, cameraPosition: new THREE.Vector3(0, 0, 100) }),
      ),
    ).toEqual(['child']);
    expect(
      selectStarTileNodeIds(
        nodes,
        view({ lodLevel: 2, cameraPosition: new THREE.Vector3(0, 0, 100) }),
      ),
    ).toEqual(['child']);
    expect(
      selectStarTileNodeIds(
        nodes,
        view({ lodLevel: 3, cameraPosition: new THREE.Vector3(0, 0, 100) }),
      ),
    ).toEqual(['root']);
    expect(
      selectStarTileNodeIds(
        nodes,
        view({ lodLevel: 4, cameraPosition: new THREE.Vector3(0, 0, 100) }),
      ),
    ).toEqual(['root']);
    expect(
      selectVisibleStarTileRootNodeIds(
        nodes,
        view({ lodLevel: 2, cameraPosition: new THREE.Vector3(0, 0, 100) }),
      ),
    ).toEqual(['root']);
    expect(selectVisibleStarTileRootNodeIds(nodes, view({ lodLevel: 0 }))).toEqual([]);
  });

  it('retarde le raffinement spatial tant que le voisinage stellaire reste comprimé', () => {
    const nodes = [
      renderNode('root', 0, 0, 18, ['child']),
      renderNode('child', 0, 0, 5, [], 'root'),
    ];

    expect(
      selectStarTileNodeIds(nodes, view({ lodLevel: 2, stellarNeighborhoodReveal: 0 })),
    ).toEqual(['root']);
    expect(
      selectStarTileNodeIds(nodes, view({ lodLevel: 2, stellarNeighborhoodReveal: 1 })),
    ).toEqual(['child']);
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

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'low' }))).toEqual([
      'a-0',
      'a-1',
      'b-0',
      'root-c',
    ]);
    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'high' }))).toEqual([
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

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'high' }))).toEqual([
      'leaf',
      'small',
    ]);
  });

  it('ne raffine pas une grande racine dont aucune cellule détaillée ne coupe le champ', () => {
    const nodes = [
      renderNode('root-visible', 0, 0, 18, ['visible-child']),
      renderNode('root-offscreen', 150, 0, 100, ['offscreen-child']),
      renderNode('visible-child', 0, 0, 5, [], 'root-visible'),
      renderNode('offscreen-child', 150, 0, 5, [], 'root-offscreen'),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'high' }))).toEqual([
      'root-offscreen',
      'visible-child',
    ]);
  });

  it('raffine une racine hors centre lorsque ses sources détaillées coupent encore le champ', () => {
    const nodes = [
      renderNode('root-offscreen', 150, 0, 100, ['edge-child']),
      renderNode('edge-child', 95, 0, 10, [], 'root-offscreen', 96),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'high' }))).toEqual([
      'edge-child',
    ]);
  });

  it('priorise le nombre de sources détaillées visibles avant la position lexicale', () => {
    const nodes = [
      renderNode('root-a', -20, 0, 18, ['a-child']),
      renderNode('root-b', 0, 0, 18, ['b-child']),
      renderNode('root-c', 20, 0, 18, ['c-child']),
      renderNode('a-child', -20, 0, 5, [], 'root-a', 2),
      renderNode('b-child', 0, 0, 5, [], 'root-b', 96),
      renderNode('c-child', 20, 0, 5, [], 'root-c', 48),
    ];

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'low' }))).toEqual([
      'b-child',
      'c-child',
      'root-a',
    ]);
  });

  it('borne le raffinement haute qualité à seize racines', () => {
    const roots = Array.from({ length: 17 }, (_, index) => {
      const rootId = `root-${index.toString().padStart(2, '0')}`;

      return renderNode(rootId, 0, 0, 18, [`${rootId}-child`]);
    });
    const children = roots.map((root) => renderNode(`${root.id}-child`, 0, 0, 5, [], root.id, 96));
    const selectedIds = selectStarTileNodeIds(
      [...roots, ...children],
      view({ lodLevel: 2, quality: 'high' }),
    );

    expect(selectedIds).toHaveLength(17);
    expect(selectedIds.filter((id) => id.endsWith('-child'))).toHaveLength(16);
    expect(selectedIds).toContain('root-16');
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

    expect(selectStarTileNodeIds(nodes, view({ lodLevel: 2, quality: 'low' }))).toEqual([
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
        view({ lodLevel: 2, worldOffset: new THREE.Vector3(-500, 0, 0) }),
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
    const snapshot = createStarTileView(camera, 900, 2, 'medium', new THREE.Vector3(4, 5, 6), 2);

    camera.position.set(9, 9, 9);
    expect(snapshot.cameraPosition.toArray()).toEqual([1, 2, 100]);
    expect(snapshot.worldOffset.toArray()).toEqual([4, 5, 6]);
    expect(snapshot.viewportHeight).toBe(900);
    expect(snapshot.projectionScaleY).toBeGreaterThan(1);
    expect(snapshot.stellarNeighborhoodReveal).toBe(1);
  });
});

function renderNode(
  id: string,
  x: number,
  y: number,
  radius: number,
  childIds: readonly string[] = [],
  parentId?: string,
  clusterCount = 1,
): StarTileRenderNode {
  return {
    id,
    parentId,
    childIds,
    clusterCount,
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
    representation: 'aggregate-cell',
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
    representation: 'sampled-source',
    url: '/child.json',
  };

  return {
    version: '5.0.0',
    sourceCatalog: 'fixture',
    sourceStarCount: 2,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'parsec',
    magnitudeBand: 'johnson-v',
    colorIndexSystem: 'johnson-b-v',
    source: {
      name: 'Fixture',
      url: 'https://example.test/fixture',
      doi: null,
      credit: 'Fixture',
      retrievedAt: '2026-08-28T00:00:00.000Z',
      query: 'fixture',
    },
    selection: {
      maximumDistanceParsec: 1,
      maximumApparentMagnitude: 12,
      minimumParallaxOverError: 10,
    },
    sampling: {
      method: 'brightest-plus-deterministic-uniform',
      maximumSamplesPerLeaf: 96,
      brightestSamplesPerLeaf: 32,
    },
    scientificConfidence: 'calculated',
    representation: 'hierarchical-aggregation-with-deterministic-samples',
    rootIds: ['root'],
    nodes: [root, child],
  };
}
