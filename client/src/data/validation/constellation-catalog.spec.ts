import { type ConstellationCatalog } from '../models/universe.models';
import {
  assertConstellationCatalogReferences,
  parseConstellationCatalog,
} from './constellation-catalog';

describe('catalogue des tracés de constellations', () => {
  it('valide les métadonnées et les segments HYG illustratifs', () => {
    const catalog = parseConstellationCatalog(validCatalog(), 'constellations');

    expect(catalog).toMatchObject({
      version: '1.0.0',
      referenceFrame: 'equatorial-j2000',
      scientificConfidence: 'illustrative',
      starCatalog: 'HYG v4.1',
    });
    expect(catalog.figures[0]).toEqual({
      id: 'orion',
      name: 'Orion',
      abbreviation: 'Ori',
      segments: [
        [10, 20],
        [20, 30],
      ],
    });
  });

  it.each([
    null,
    {},
    { ...validCatalog(), version: 1 },
    { ...validCatalog(), source: null },
    { ...validCatalog(), source: { name: '', url: 'source', license: 'CC BY-SA 4.0' } },
    { ...validCatalog(), source: { name: 'Stellarium', url: '', license: 'CC BY-SA 4.0' } },
    { ...validCatalog(), source: { name: 'Stellarium', url: 'source', license: '' } },
    { ...validCatalog(), referenceFrame: 'galactic' },
    { ...validCatalog(), scientificConfidence: 'observed' },
    { ...validCatalog(), starCatalog: '' },
    { ...validCatalog(), figures: null },
    { ...validCatalog(), figures: [] },
  ])('rejette une racine ou une provenance invalide', (value) => {
    expect(() => parseConstellationCatalog(value, 'cassé')).toThrow(
      'Catalogue de constellations invalide : cassé.',
    );
  });

  it.each([
    { id: '', name: 'Orion', abbreviation: 'Ori', segments: [[10, 20]] },
    { id: 'orion', name: '', abbreviation: 'Ori', segments: [[10, 20]] },
    { id: 'orion', name: 'Orion', abbreviation: '', segments: [[10, 20]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Orion', segments: [[10, 20]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [[10]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [[10, 10]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [[0, 20]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [[10, 20.5]] },
    { id: 'orion', name: 'Orion', abbreviation: 'Ori', segments: [[10, '20']] },
  ])('rejette une figure ou un segment invalide', (figure) => {
    expect(() =>
      parseConstellationCatalog({ ...validCatalog(), figures: [figure] }, 'figures'),
    ).toThrow('Figure de constellation invalide dans figures, index 0.');
  });

  it('rejette les identifiants de figure et les segments non orientés dupliqués', () => {
    expect(() =>
      parseConstellationCatalog(
        {
          ...validCatalog(),
          figures: [
            validCatalog().figures[0],
            { ...validCatalog().figures[0], segments: [[30, 40]] },
          ],
        },
        'dupliqué',
      ),
    ).toThrow('Identifiant de constellation dupliqué : orion.');

    expect(() =>
      parseConstellationCatalog(
        {
          ...validCatalog(),
          figures: [
            {
              ...validCatalog().figures[0],
              segments: [
                [10, 20],
                [20, 10],
              ],
            },
          ],
        },
        'dupliqué',
      ),
    ).toThrow('Segment de constellation dupliqué : 10–20.');
  });

  it('vérifie que chaque extrémité existe dans le catalogue stellaire chargé', () => {
    const catalog = parseConstellationCatalog(validCatalog(), 'constellations');

    expect(() =>
      assertConstellationCatalogReferences(catalog, new Uint32Array([10, 20, 30])),
    ).not.toThrow();
    expect(() => assertConstellationCatalogReferences(catalog, new Uint32Array([10, 20]))).toThrow(
      'Étoile HYG 30 absente du catalogue pour la constellation orion.',
    );
  });
});

function validCatalog(): ConstellationCatalog {
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
