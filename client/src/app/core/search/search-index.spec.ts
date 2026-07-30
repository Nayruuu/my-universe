import { SpaceObject } from '../../../data/models/universe.models';
import { LocalSearchIndex, normalizeSearchText } from './search-index';

const OBJECTS: readonly SpaceObject[] = [
  {
    id: 'sun',
    name: 'Soleil',
    aliases: ['Sun'],
    type: 'star',
    referenceFrame: 'solar-system',
    scientificConfidence: 'observed',
    visual: { visualRadius: 2, scaleMode: 'exaggerated' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  },
  {
    id: 'earth',
    name: 'Terre',
    aliases: ['Earth', 'Gaïa'],
    type: 'planet',
    parentId: 'sun',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'exaggerated' },
    positionProvider: {
      type: 'static',
      position: [1, 0, 0],
      unit: 'astronomical-unit',
    },
  },
];

describe('recherche locale', () => {
  it('ignore la casse et les accents', () => {
    expect(normalizeSearchText('  ÉTOILE-du_Berger  ')).toBe('etoile du berger');
  });

  it('retrouve un objet par alias', () => {
    const index = new LocalSearchIndex();

    index.build(OBJECTS);
    expect(index.search('earth')[0]?.id).toBe('earth');
    expect(index.search('gaia')[0]?.id).toBe('earth');
  });

  it('classe une correspondance exacte avant une correspondance partielle', () => {
    const index = new LocalSearchIndex();

    index.build(OBJECTS);
    expect(index.search('sol')[0]?.id).toBe('sun');
  });

  it('indexe les identifiants du catalogue dense sans les transformer en objets de scène', () => {
    const index = new LocalSearchIndex();

    index.build(OBJECTS, [
      {
        id: 'hyg-32263',
        name: 'Sirius',
        aliases: ['HIP 32349', 'HD 48915', 'α CMa'],
        type: 'star',
        parentName: 'Voie lactée',
        keywords: ['HYG', 'A0m'],
      },
    ]);

    expect(index.search('HIP 32349')[0]).toMatchObject({
      id: 'hyg-32263',
      name: 'Sirius',
    });
    expect(index.search('alpha cma')[0]?.id).toBe('hyg-32263');
  });

  it('respecte la limite sans trier ni retourner tout le catalogue', () => {
    const index = new LocalSearchIndex();

    index.build(
      OBJECTS,
      Array.from({ length: 24 }, (_, indexValue) => ({
        id: `hyg-${indexValue}`,
        name: `Étoile catalogue ${indexValue.toString().padStart(2, '0')}`,
        aliases: [],
        type: 'star' as const,
      })),
    );

    expect(index.search('étoile', 5)).toHaveLength(5);
    expect(index.search('étoile', 0)).toEqual([]);
  });

  it('retourne immédiatement une liste vide pour une requête blanche', () => {
    const index = new LocalSearchIndex();

    index.build(OBJECTS);

    expect(index.search('   ')).toEqual([]);
  });

  it('indexe les mots-clés des objets et toutes les catégories de correspondance', () => {
    const index = new LocalSearchIndex();

    index.build([
      ...OBJECTS,
      {
        ...OBJECTS[0]!,
        id: 'betelgeuse',
        name: 'Bételgeuse',
        aliases: undefined,
        metadata: { keywords: 'supergéante rouge' },
      },
    ]);

    expect(index.search('telg')[0]?.id).toBe('betelgeuse');
    expect(index.search('art')[0]?.id).toBe('earth');
    expect(index.search('supergéante')[0]?.id).toBe('betelgeuse');
  });

  it('indexe une constellation illustrative comme une région recherchable', () => {
    const index = new LocalSearchIndex();

    index.build([
      ...OBJECTS,
      {
        ...OBJECTS[0]!,
        id: 'constellation-orion',
        name: 'Orion',
        aliases: ['Ori'],
        type: 'region',
        parentId: 'sun',
        scientificConfidence: 'illustrative',
        metadata: {
          keywords: 'constellation figure céleste Ori',
        },
      },
    ]);

    expect(index.search('Orion')[0]).toMatchObject({
      id: 'constellation-orion',
      parentName: 'Soleil',
      type: 'region',
    });
    expect(index.search('constellation')[0]?.id).toBe('constellation-orion');
  });

  it('départage alphabétiquement deux résultats de même score', () => {
    const index = new LocalSearchIndex();

    index.build(
      [],
      [
        { id: 'z', name: 'Alpzz', aliases: [], type: 'star' },
        { id: 'a', name: 'Alpha', aliases: [], type: 'star' },
      ],
    );

    expect(index.search('al').map((entry) => entry.name)).toEqual(['Alpha', 'Alpzz']);
  });

  it('préserve une lettre grecque sans nom déclaré', () => {
    expect(normalizeSearchText('ς')).toBe('ς');
  });
});
