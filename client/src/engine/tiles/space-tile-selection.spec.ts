import * as THREE from 'three';
import { type SpaceTileIndex } from '../../data/models/universe.models';
import {
  createSpaceTileRenderNodes,
  createSpaceTileView,
  selectSpaceTileIds,
  type SpaceTileRenderNode,
  type SpaceTileView,
} from './space-tile-selection';

describe('sélection spatiale des tuiles galactiques', () => {
  it('ne conserve hors de l’Univers proche que les tuiles explicitement ciblées', () => {
    const nodes = [renderNode('visible', 0, 0, 10), renderNode('retained', 500, 0, 10)];

    expect(selectSpaceTileIds(nodes, view({ lodLevel: 4 }), [])).toEqual([]);
    expect(selectSpaceTileIds(nodes, view({ lodLevel: 4 }), ['retained', 'missing'])).toEqual([
      'retained',
    ]);
  });

  it('filtre le frustum et applique les budgets faible, moyen et élevé', () => {
    const nodes = [
      renderNode('largest', 0, 0, 18),
      renderNode('large', 20, 0, 14),
      renderNode('medium', -30, 0, 10),
      renderNode('small', 35, 0, 6),
      renderNode('tiny', -40, 0, 3),
      renderNode('hidden', 500, 0, 100),
    ];

    expect(selectSpaceTileIds(nodes, view({ quality: 'low' }), [])).toEqual(['large', 'largest']);
    expect(selectSpaceTileIds(nodes, view({ quality: 'medium' }), [])).toEqual([
      'large',
      'largest',
      'medium',
    ]);
    expect(selectSpaceTileIds(nodes, view({ quality: 'high' }), [])).toEqual([
      'large',
      'largest',
      'medium',
      'small',
      'tiny',
    ]);
  });

  it('ajoute une cible hors champ sans la compter dans le budget visuel', () => {
    const nodes = [
      renderNode('visible-a', 0, 0, 18),
      renderNode('visible-b', 20, 0, 14),
      renderNode('visible-c', -30, 0, 10),
      renderNode('retained', 500, 0, 5),
    ];

    expect(selectSpaceTileIds(nodes, view({ quality: 'low' }), ['retained'])).toEqual([
      'retained',
      'visible-a',
      'visible-b',
    ]);
  });

  it('départage de façon stable les tuiles de même taille apparente', () => {
    const nodes = [
      renderNode('tile-c', 0, 0, 20),
      renderNode('tile-a', 0, 0, 20),
      renderNode('tile-b', 0, 0, 20),
    ];

    expect(selectSpaceTileIds(nodes, view({ quality: 'low' }), [])).toEqual(['tile-a', 'tile-b']);
  });

  it('raffine récursivement la cellule dominante sans dépasser le budget visuel', () => {
    const nodes = [
      renderNode('root-a', 0, 0, 80, ['child-a', 'child-b']),
      renderNode('root-b', 45, 0, 14),
      renderNode('child-a', 0, 0, 35, ['grandchild-a'], 'root-a'),
      renderNode('child-b', 30, 0, 12, [], 'root-a'),
      renderNode('grandchild-a', 0, 0, 15, [], 'child-a'),
    ];

    expect(selectSpaceTileIds(nodes, view({ quality: 'low' }), [])).toEqual(['child-a', 'root-a']);
    expect(selectSpaceTileIds(nodes, view({ quality: 'high' }), [])).toEqual([
      'child-a',
      'child-b',
      'grandchild-a',
      'root-a',
      'root-b',
    ]);
  });

  it('garde les racines seules tant que leur taille apparente ne justifie pas le détail', () => {
    const nodes = [
      renderNode('root-a', 0, 0, 2, ['child-a']),
      renderNode('root-b', 20, 0, 1),
      renderNode('child-a', 0, 0, 0.5, [], 'root-a'),
    ];

    expect(
      selectSpaceTileIds(nodes, view({ cameraPosition: new THREE.Vector3(0, 0, 10_000) }), []),
    ).toEqual(['root-a', 'root-b']);
  });

  it('conserve la cellule dominante si aucun enfant déclaré n’est visible', () => {
    const nodes = [
      renderNode('root-a', 0, 0, 80, ['hidden-child']),
      renderNode('root-b', 30, 0, 12),
      renderNode('hidden-child', 500, 0, 10, [], 'root-a'),
    ];

    expect(selectSpaceTileIds(nodes, view({ quality: 'low' }), [])).toEqual(['root-a', 'root-b']);
  });

  it('conserve directement une tuile enfant ciblée hors du chemin de raffinement', () => {
    const nodes = [
      renderNode('root', 0, 0, 2, ['child']),
      renderNode('child', 500, 0, 1, [], 'root'),
    ];

    expect(selectSpaceTileIds(nodes, view(), ['child'])).toEqual(['child', 'root']);
  });

  it('applique le floating origin au test de visibilité', () => {
    const nodes = [renderNode('shifted', 500, 0, 10)];

    expect(
      selectSpaceTileIds(nodes, view({ worldOffset: new THREE.Vector3(-500, 0, 0) }), []),
    ).toEqual(['shifted']);
  });

  it('projette les bornes scientifiques et capture une caméra immuable', () => {
    const renderNodes = createSpaceTileRenderNodes(index(), (position, _unit, _frame, target) =>
      target.set(position[0] * 2, position[1] * 2, position[2] * 2),
    );

    expect(renderNodes[0]?.center.toArray()).toEqual([0, 0, 0]);
    expect(renderNodes[0]?.radius).toBeCloseTo(Math.sqrt(12), 8);

    const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 2_000);

    camera.position.set(1, 2, 100);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const snapshot = createSpaceTileView(camera, 0, 5, 'medium', new THREE.Vector3(4, 5, 6));

    camera.position.set(9, 9, 9);
    expect(snapshot.cameraPosition.toArray()).toEqual([1, 2, 100]);
    expect(snapshot.worldOffset.toArray()).toEqual([4, 5, 6]);
    expect(snapshot.viewportHeight).toBe(1);
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
): SpaceTileRenderNode {
  return {
    id,
    parentId,
    childIds,
    center: new THREE.Vector3(x, y, 0),
    radius,
  };
}

function view(overrides: Partial<SpaceTileView> = {}): SpaceTileView {
  return {
    lodLevel: 5,
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

function index(): SpaceTileIndex {
  return {
    version: '1.0.0',
    tiles: [
      {
        id: 'tile',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/tile.json',
        bounds: {
          min: [-1, -1, -1],
          max: [1, 1, 1],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy'],
      },
    ],
    searchEntries: [],
  };
}
