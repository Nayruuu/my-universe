import * as THREE from 'three';
import { type ConstellationCatalog } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { ConstellationVisual } from './constellation-visual';

describe('ConstellationVisual', () => {
  it('construit le tracé partagé, ses cibles et la surbrillance réutilisable', () => {
    const visual = new ConstellationVisual(catalog(), createRegistry());
    const positions = visual.lines.geometry.getAttribute('position');

    expect(visual.root.children).toEqual([visual.lines, visual.highlightLines]);
    expect(positions.count).toBe(4);
    expect(visual.lines.userData).toMatchObject({
      figureCount: 1,
      segmentCount: 2,
      objectIds: [
        'constellation-orion',
        'constellation-orion',
        'constellation-orion',
        'constellation-orion',
      ],
      visibleIndices: new Uint8Array([1, 1, 1, 1]),
    });
    expect(visual.has('constellation-orion')).toBe(true);
    expect(visual.getDefinition('constellation-orion')).toMatchObject({
      id: 'constellation-orion',
      name: 'Orion',
      metadata: { abbreviation: 'Ori', segmentCount: 2, starCount: 3 },
    });
    expect(visual.getWorldPosition('constellation-orion')).toBeInstanceOf(THREE.Vector3);
    expect(visual.getFocusRadius('constellation-orion')).toBeGreaterThan(0);

    visual.showHighlight('constellation-orion');
    expect(visual.highlightLines.geometry.drawRange.count).toBe(4);
    expect(visual.highlightLines.userData['objectId']).toBe('constellation-orion');
    visual.showHighlight(null);
    expect(visual.highlightLines.geometry.drawRange.count).toBe(0);
    expect(visual.highlightLines.userData['objectId']).toBeNull();

    visual.dispose();
    expect(visual.root.children).toHaveLength(0);
  });

  it('refuse une étoile absente du catalogue', () => {
    expect(
      () =>
        new ConstellationVisual(
          {
            ...catalog(),
            figures: [{ ...catalog().figures[0]!, segments: [[10, 99]] }],
          },
          createRegistry(),
        ),
    ).toThrow('Étoile HYG 99 introuvable pour le tracé de orion.');
  });

  it('suit les étoiles propagées sans recréer les géométries', () => {
    const registry = createRegistry();

    registry.catalog.velocitiesParsecPerYear[0] = 0.01;
    const visual = new ConstellationVisual(catalog(), registry);
    const geometry = visual.lines.geometry;
    const initialPositions = (geometry.getAttribute('position').array as Float32Array).slice();
    const initialCenter = visual.getWorldPosition('constellation-orion')!.clone();

    registry.updateTime({ julianDay: 2_451_545 + 100 * 365.25 });
    visual.updatePositions();

    expect(visual.lines.geometry).toBe(geometry);
    expect(geometry.getAttribute('position').array).not.toEqual(initialPositions);
    expect(visual.getWorldPosition('constellation-orion')).not.toEqual(initialCenter);

    visual.showHighlight('constellation-orion');
    registry.updateTime({ julianDay: 2_451_545 + 200 * 365.25 });
    visual.updatePositions();
    expect(visual.highlightLines.geometry.drawRange.count).toBe(4);
    visual.dispose();
  });
});

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
