import type { CometActivityDefinition } from '../../data/models/universe.models';
import { calculateCometActivity } from './comet-activity';

const ACTIVITY: CometActivityDefinition = {
  activationDistanceAu: 5,
  saturatedDistanceAu: 1,
  scientificConfidence: 'illustrative',
  source: 'NASA comet activity overview',
};

describe('calculateCometActivity', () => {
  it('maintient le noyau inactif au-delà de la distance documentée', () => {
    expect(calculateCometActivity(5, ACTIVITY)).toEqual({
      intensity: 0,
      comaScale: 0,
      tailScale: 0,
    });
    expect(calculateCometActivity(12, ACTIVITY).intensity).toBe(0);
  });

  it('sature progressivement l’activité à proximité du Soleil', () => {
    expect(calculateCometActivity(3, ACTIVITY)).toEqual({
      intensity: 0.5,
      comaScale: Math.sqrt(0.5),
      tailScale: 0.5,
    });
    expect(calculateCometActivity(1, ACTIVITY).intensity).toBe(1);
    expect(calculateCometActivity(0, ACTIVITY).intensity).toBe(1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejette une distance héliocentrique invalide (%s)',
    (distanceAu) => {
      expect(() => calculateCometActivity(distanceAu, ACTIVITY)).toThrow(
        'Distance héliocentrique invalide',
      );
    },
  );

  it.each([
    { activationDistanceAu: 0 },
    { activationDistanceAu: Number.POSITIVE_INFINITY },
    { saturatedDistanceAu: -1 },
    { saturatedDistanceAu: Number.NaN },
    { activationDistanceAu: 1, saturatedDistanceAu: 1 },
    { activationDistanceAu: 1, saturatedDistanceAu: 2 },
  ])('rejette un profil d’activité incohérent', (overrides) => {
    expect(() => calculateCometActivity(1, { ...ACTIVITY, ...overrides })).toThrow(
      'Profil d’activité cométaire invalide',
    );
  });
});
