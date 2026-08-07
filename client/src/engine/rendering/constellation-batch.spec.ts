import * as THREE from 'three';
import { type ConstellationCatalog } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { ConstellationBatch } from './constellation-batch';

describe('ConstellationBatch', () => {
  it('regroupe tous les segments dans un seul objet Three.js', () => {
    const batch = createBatch();
    const positions = batch.lines.geometry.getAttribute('position');

    expect(batch.root.children).toEqual([batch.lines, batch.highlightLines]);
    expect(batch.lines).toBeInstanceOf(THREE.LineSegments);
    expect(positions.count).toBe(4);
    expect(batch.lines.userData).toMatchObject({
      figureCount: 1,
      segmentCount: 2,
      scientificConfidence: 'illustrative',
      referenceFrame: 'equatorial-j2000',
      objectIds: [
        'constellation-orion',
        'constellation-orion',
        'constellation-orion',
        'constellation-orion',
      ],
    });
    expect(batch.lines.userData['visibleIndices']).toEqual(new Uint8Array([1, 1, 1, 1]));
    expect(batch.getPickables()).toEqual([]);

    const firstStar = new THREE.Vector3().fromBufferAttribute(positions, 0);
    const secondStar = new THREE.Vector3().fromBufferAttribute(positions, 1);

    expect(firstStar.distanceTo(secondStar)).toBeGreaterThan(0);
    batch.updatePositions();
    expect(batch.lines.geometry.getAttribute('position')).toBe(positions);
    batch.dispose();
  });

  it('expose chaque figure comme une cible illustrative cadrable', () => {
    const batch = createBatch();
    const definition = batch.getDefinition('constellation-orion');
    const position = batch.getWorldPosition('constellation-orion');

    expect(batch.definitions).toHaveLength(1);
    expect(batch.has('constellation-orion')).toBe(true);
    expect(batch.has('constellation-inconnue')).toBe(false);
    expect(definition).toMatchObject({
      id: 'constellation-orion',
      name: 'Orion',
      aliases: ['Ori'],
      type: 'region',
      parentId: 'milky-way',
      referenceFrame: 'stellar',
      scientificConfidence: 'illustrative',
      metadata: {
        abbreviation: 'Ori',
        constellationLabelRank: 0,
        segmentCount: 2,
        starCount: 3,
      },
    });
    expect(definition?.visual.visualRadius).toBeGreaterThan(0);
    expect(position).toBeInstanceOf(THREE.Vector3);
    expect(batch.getWorldPosition('constellation-inconnue')).toBeNull();
    expect(batch.getDefinition('constellation-inconnue')).toBeUndefined();
    expect(batch.getFocusRadius('constellation-orion')).toBe(definition?.visual.visualRadius);
    expect(batch.getFocusRadius('constellation-inconnue')).toBeNull();
    batch.dispose();
  });

  it('réutilise un unique tracé de surbrillance pour le survol et la sélection', () => {
    const batch = createBatch();

    expect(batch.highlightLines.visible).toBe(false);
    expect(batch.highlightLines.geometry.drawRange.count).toBe(0);

    batch.select('constellation-orion');
    batch.updateLod(2, 10);

    expect(batch.highlightLines.visible).toBe(true);
    expect(batch.highlightLines.geometry.drawRange.count).toBe(4);
    expect(batch.highlightLines.userData['objectId']).toBe('constellation-orion');
    expect(batch.highlightLines.material.opacity).toBeGreaterThan(0.9);
    expect(batch.highlightLines.material.blending).toBe(THREE.AdditiveBlending);
    expect(batch.highlightLines.material.color.b).toBeGreaterThan(0.95);
    expect(batch.highlightLines.userData['visualStyle']).toBe('additive-target-highlight');

    batch.hover('constellation-inconnue');
    expect(batch.highlightLines.userData['objectId']).toBe('constellation-orion');
    batch.hover('constellation-orion');
    expect(batch.highlightLines.userData['objectId']).toBe('constellation-orion');
    batch.select(null);
    expect(batch.highlightLines.userData['objectId']).toBe('constellation-orion');
    batch.updateLod(2, 10);
    expect(batch.highlightLines.material.opacity).toBeGreaterThan(0.7);
    expect(batch.highlightLines.material.opacity).toBeLessThan(0.8);
    expect(batch.highlightLines.material.color.getHex()).toBe(0xaee5ff);
    batch.hover(null);
    expect(batch.highlightLines.geometry.drawRange.count).toBe(0);
    expect(batch.highlightLines.visible).toBe(false);

    batch.dispose();
  });

  it('classe les noms par éclat puis alphabétiquement à éclat égal', () => {
    const batch = new ConstellationBatch(rankingCatalog(), createRegistry());
    const ranks = new Map(
      batch.definitions.map((definition) => [
        definition.id,
        definition.metadata?.['constellationLabelRank'],
      ]),
    );

    expect(ranks).toEqual(
      new Map([
        ['constellation-andromeda', 0],
        ['constellation-lyra', 1],
        ['constellation-orion', 2],
      ]),
    );
    batch.dispose();
  });

  it('applique un fondu selon le LOD et l’option utilisateur', () => {
    const batch = createBatch();

    expect(batch.lines.visible).toBe(false);
    batch.updateLod(2, 10);
    expect(batch.lines.visible).toBe(true);
    expect(batch.lines.material.opacity).toBeGreaterThan(0.18);
    expect(batch.lines.material.opacity).toBeLessThan(0.28);
    expect(batch.getPickables()).toEqual([batch.lines]);

    batch.updateLod(3, 10);
    expect(batch.lines.visible).toBe(false);
    expect(batch.lines.material.opacity).toBeLessThan(0.004);
    batch.updateLod(5, 10);
    expect(batch.lines.visible).toBe(false);

    batch.setEnabled(false);
    batch.updateLod(1, 10);
    expect(batch.lines.visible).toBe(false);
    expect(batch.getPickables()).toEqual([]);

    batch.setEnabled(true);
    batch.updateLod(1, 0);
    expect(batch.lines.visible).toBe(false);
    batch.updateLod(1, 10);
    expect(batch.lines.visible).toBe(true);
    batch.updateLod(99, 10);
    expect(batch.lines.visible).toBe(false);
    batch.dispose();
  });

  it('refuse une référence absente et libère la géométrie et le matériau créés', () => {
    const registry = createRegistry();

    expect(
      () =>
        new ConstellationBatch(
          {
            ...catalog(),
            figures: [
              {
                ...catalog().figures[0]!,
                segments: [[10, 99]],
              },
            ],
          },
          registry,
        ),
    ).toThrow('Étoile HYG 99 introuvable pour le tracé de orion.');

    const batch = new ConstellationBatch(catalog(), registry);
    const geometryDispose = vi.spyOn(batch.lines.geometry, 'dispose');
    const materialDispose = vi.spyOn(batch.lines.material, 'dispose');
    const highlightGeometryDispose = vi.spyOn(batch.highlightLines.geometry, 'dispose');
    const highlightMaterialDispose = vi.spyOn(batch.highlightLines.material, 'dispose');

    batch.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(highlightGeometryDispose).toHaveBeenCalledOnce();
    expect(highlightMaterialDispose).toHaveBeenCalledOnce();
    expect(batch.root.children).toHaveLength(0);
  });
});

function createBatch(): ConstellationBatch {
  return new ConstellationBatch(catalog(), createRegistry());
}

function catalog(): ConstellationCatalog {
  return {
    version: '1.0.0',
    source: {
      name: 'Stellarium Modern sky culture',
      url: 'https://github.com/Stellarium/stellarium/tree/master/skycultures/modern',
      license: 'CC BY-SA 4.0',
    },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: 'HYG v4.1',
    figures: [
      {
        id: 'orion',
        name: 'Orion',
        abbreviation: 'Ori',
        segments: [
          [10, 20],
          [20, 30],
        ],
      },
    ],
  };
}

function rankingCatalog(): ConstellationCatalog {
  return {
    ...catalog(),
    figures: [
      {
        id: 'andromeda',
        name: 'Andromeda',
        abbreviation: 'And',
        segments: [[10, 30]],
      },
      {
        id: 'lyra',
        name: 'Lyra',
        abbreviation: 'Lyr',
        segments: [[10, 20]],
      },
      {
        id: 'orion',
        name: 'Orion',
        abbreviation: 'Ori',
        segments: [[20, 30]],
      },
    ],
  };
}

function createRegistry(): StarCatalogRegistry {
  const starCatalog: StarCatalog = {
    count: 3,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array([1, 0, 0, 0, 2, 0, 0, 0, 3]),
    velocitiesParsecPerYear: new Float32Array(9),
    apparentMagnitudes: new Float32Array([1, 2, 3]),
    colorIndicesBv: new Float32Array([0.2, 0.5, 0.8]),
    catalogIds: new Uint32Array([10, 20, 30]),
    names: ['Alpha', 'Beta', 'Gamma'],
    aliases: [[], [], []],
    spectralTypes: ['A0', 'F0', 'G0'],
  };

  return new StarCatalogRegistry(starCatalog, new CoordinateSystem());
}
