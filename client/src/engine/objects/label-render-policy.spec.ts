import { SpaceObject } from '../../data/models/universe.models';
import type { LabelCandidate } from './label-candidate-collector';
import {
  getLabelRenderFlags,
  getMaximumOrdinaryLabelCount,
  isLabelWithinOrdinaryBudget,
} from './label-render-policy';
import type { LabelObject } from './label-visibility-policy';

describe('budget de rendu des labels', () => {
  it('réserve une place unique au repère permanent de l’échelle', () => {
    const candidates = [candidate(createLabelObject('earth', 'planet'))];

    expect(getMaximumOrdinaryLabelCount('high', 0, 'balanced', candidates)).toBe(64);

    candidates.push(candidate(createLabelObject('sun', 'star')));
    expect(getMaximumOrdinaryLabelCount('high', 0, 'balanced', candidates)).toBe(63);

    candidates.push(candidate(createLabelObject('sun', 'star')));
    expect(getMaximumOrdinaryLabelCount('high', 0, 'balanced', candidates)).toBe(63);
  });

  it('laisse la sélection et le repère dépasser le plafond ordinaire', () => {
    const ordinary = candidate(createLabelObject('sirius', 'star'));
    const selected = { ...ordinary, selected: true };

    expect(isLabelWithinOrdinaryBudget(ordinary, false, 4, 5)).toBe(true);
    expect(isLabelWithinOrdinaryBudget(ordinary, false, 5, 5)).toBe(false);
    expect(isLabelWithinOrdinaryBudget(selected, false, 5, 5)).toBe(true);
    expect(isLabelWithinOrdinaryBudget(ordinary, true, 5, 5)).toBe(true);
  });
});

describe('présentation des labels', () => {
  it.each([
    ['planète principale', createLabelObject('earth', 'planet'), 1, true, true, false],
    ['Soleil', createLabelObject('sun', 'star'), 1, false, true, true],
    ['étoile', createLabelObject('sirius', 'star'), 1, true, false, false],
    ['trou noir', createLabelObject('gaia-bh1', 'black-hole'), 2, true, false, false],
    ['supernova', createLabelObject('sn-1987a', 'supernova'), 2, true, false, false],
    ['rémanent', createLabelObject('cassiopeia-a', 'supernova-remnant'), 2, true, false, false],
    [
      'catalogue cosmique',
      createLabelObject('cf4-pgc-35', 'galaxy-cluster', { cosmicCatalogRank: 0 }),
      6,
      true,
      false,
      false,
    ],
    ['galaxie ordinaire', createLabelObject('andromeda', 'galaxy'), 4, false, false, false],
  ] as const)(
    'calcule les indicateurs du label %s',
    (_name, object, lodLevel, drawAnchor, solarSystemLabel, scaleLandmark) => {
      expect(getLabelRenderFlags(object, lodLevel)).toEqual({
        drawAnchor,
        solarSystemLabel,
        solarSystemPrimaryLabel: object.id === 'earth',
        scaleLandmark,
      });
    },
  );
});

function candidate(object: LabelObject): LabelCandidate {
  return {
    object,
    distanceSquared: 1,
    priority: 0,
    selected: false,
  };
}

function createLabelObject(
  id: string,
  type: SpaceObject['type'],
  metadata?: SpaceObject['metadata'],
): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: type === 'galaxy' ? 'galactic' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
    ...(metadata ? { metadata } : {}),
  };
}
