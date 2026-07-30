import { SpaceObject } from '../../data/models/universe.models';
import { getNavigationReferenceFrame, NavigationContextJourney } from './navigation-context';

describe('NavigationContextJourney', () => {
  const objects = new Map(
    [
      object('cosmic-web', 'universe', undefined, 'cosmic-web'),
      object('nearby-universe', 'region', 'cosmic-web', 'nearby-universe'),
      object('local-group', 'region', 'nearby-universe', 'local-group'),
      object('milky-way', 'galaxy', 'local-group', 'local-group'),
      object('andromeda', 'galaxy', 'local-group', 'local-group'),
      object('sun', 'star', 'milky-way', 'solar-system'),
      object('earth', 'planet', 'sun', 'solar-system'),
      object('moon', 'moon', 'earth', 'solar-system'),
      object('sirius', 'star', 'milky-way', 'stellar'),
      object('exo-star', 'star', 'andromeda', 'stellar'),
      object('exo-planet', 'planet', 'exo-star', 'stellar'),
      object('virgo-cluster', 'galaxy-cluster', 'nearby-universe', 'nearby-universe'),
      object('m87', 'galaxy', 'virgo-cluster', 'nearby-universe'),
      object('cf4-pgc-42', 'galaxy-cluster', 'cosmic-web', 'cosmic-web'),
    ].map((candidate) => [candidate.id, candidate]),
  );
  const getObject = (objectId: string): SpaceObject | undefined => objects.get(objectId);

  it('conserve la chaîne canonique terrestre pendant un aller-retour complet', () => {
    const journey = new NavigationContextJourney(getObject);

    journey.adoptTarget('earth');

    expect(targets(journey)).toEqual([
      'earth',
      'sun',
      'sun',
      'milky-way',
      'local-group',
      'nearby-universe',
      'cosmic-web',
    ]);
    expect([6, 5, 4, 3, 2, 1, 0].map((level) => journey.resolve(level).targetId)).toEqual([
      'cosmic-web',
      'nearby-universe',
      'local-group',
      'milky-way',
      'sun',
      'sun',
      'earth',
    ]);
  });

  it('préserve le contexte choisi pour une étoile ou une galaxie arbitraire', () => {
    const journey = new NavigationContextJourney(getObject);

    journey.adoptTarget('sirius');
    expect(targets(journey)).toEqual([
      'sirius',
      'sirius',
      'sirius',
      'milky-way',
      'local-group',
      'nearby-universe',
      'cosmic-web',
    ]);

    journey.adoptTarget('andromeda');
    expect(targets(journey)).toEqual([
      'andromeda',
      'andromeda',
      'andromeda',
      'andromeda',
      'local-group',
      'nearby-universe',
      'cosmic-web',
    ]);
  });

  it('résout une hiérarchie générique planète, étoile, galaxie, groupe et univers', () => {
    const journey = new NavigationContextJourney(getObject);

    journey.adoptTarget('exo-planet');

    expect(targets(journey)).toEqual([
      'exo-planet',
      'exo-star',
      'exo-star',
      'andromeda',
      'local-group',
      'nearby-universe',
      'cosmic-web',
    ]);

    journey.adoptTarget('m87');
    expect(targets(journey)).toEqual([
      'm87',
      'm87',
      'm87',
      'm87',
      'virgo-cluster',
      'nearby-universe',
      'cosmic-web',
    ]);

    journey.adoptTarget('cf4-pgc-42');
    expect(targets(journey)).toEqual([
      'cf4-pgc-42',
      'cf4-pgc-42',
      'cf4-pgc-42',
      'cf4-pgc-42',
      'cf4-pgc-42',
      'cf4-pgc-42',
      'cosmic-web',
    ]);
  });

  it('utilise la route d’accueil pour une cible d’échelle canonique', () => {
    const journey = new NavigationContextJourney(getObject);

    journey.adoptTarget('local-group');

    expect(targets(journey)).toEqual([
      'earth',
      'sun',
      'sun',
      'milky-way',
      'local-group',
      'nearby-universe',
      'cosmic-web',
    ]);
  });

  it('borne les niveaux, tolère les données incomplètes et se réinitialise', () => {
    const journey = new NavigationContextJourney(getObject);

    journey.adoptTarget('unknown');
    expect(journey.resolve(-10).targetId).toBe('unknown');
    expect(journey.resolve(99).targetId).toBe('unknown');

    objects.set('cycle-a', object('cycle-a', 'star', 'cycle-b', 'stellar'));
    objects.set('cycle-b', object('cycle-b', 'galaxy', 'cycle-a', 'galactic'));
    journey.adoptTarget('cycle-a');
    expect(journey.resolve(3).targetId).toBe('cycle-b');

    journey.clear();
    expect(journey.resolve(2)).toEqual({
      targetId: null,
      referenceFrame: 'stellar',
      lodLevel: 2,
    });
  });

  it('associe chaque niveau visuel à son référentiel scientifique', () => {
    expect([-1, 0, 1, 2, 3, 4, 5, 6, 12].map(getNavigationReferenceFrame)).toEqual([
      'solar-system',
      'solar-system',
      'solar-system',
      'stellar',
      'galactic',
      'local-group',
      'nearby-universe',
      'cosmic-web',
      'cosmic-web',
    ]);
  });
});

function targets(journey: NavigationContextJourney): Array<string | null> {
  return [0, 1, 2, 3, 4, 5, 6].map((level) => journey.resolve(level).targetId);
}

function object(
  id: string,
  type: SpaceObject['type'],
  parentId: string | undefined,
  referenceFrame: SpaceObject['referenceFrame'],
): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame,
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}
