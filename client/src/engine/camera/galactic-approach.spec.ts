import { MILKY_WAY_NAVIGATION_DISTANCE } from './navigation-scales';
import {
  GALACTIC_APPROACH_OUTER_DISTANCE,
  GALACTIC_APPROACH_PIVOT_END_DISTANCE,
  GALACTIC_APPROACH_PIVOT_START_DISTANCE,
  GALACTIC_APPROACH_VIEW_END_DISTANCE,
  sampleGalacticApproach,
} from './galactic-approach';

describe('sampleGalacticApproach', () => {
  it('déplace continûment le pivot du centre galactique vers le système stellaire', () => {
    expect(sampleGalacticApproach(GALACTIC_APPROACH_OUTER_DISTANCE)).toMatchObject({
      active: true,
      pivotProgress: 0,
    });
    expect(sampleGalacticApproach(GALACTIC_APPROACH_PIVOT_END_DISTANCE)).toMatchObject({
      active: true,
      pivotProgress: 1,
    });
    expect(sampleGalacticApproach(GALACTIC_APPROACH_PIVOT_START_DISTANCE)).toMatchObject({
      active: true,
      pivotProgress: 0,
    });

    const galacticArrival = sampleGalacticApproach(MILKY_WAY_NAVIGATION_DISTANCE);

    expect(galacticArrival.pivotProgress).toBeGreaterThan(0);
    expect(galacticArrival.pivotProgress).toBeLessThan(0.12);

    let previousProgress = 0;

    for (let distance = 16_500; distance >= GALACTIC_APPROACH_PIVOT_END_DISTANCE; distance -= 250) {
      const progress = sampleGalacticApproach(distance).pivotProgress;

      expect(progress).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = progress;
    }
  });

  it('ouvre le disque à l’approche puis plonge continûment vers le plan galactique', () => {
    const outside = sampleGalacticApproach(GALACTIC_APPROACH_OUTER_DISTANCE);
    const revealStart = sampleGalacticApproach(GALACTIC_APPROACH_PIVOT_START_DISTANCE);
    const overview = sampleGalacticApproach(MILKY_WAY_NAVIGATION_DISTANCE);
    const entry = sampleGalacticApproach(GALACTIC_APPROACH_VIEW_END_DISTANCE);

    expect(outside.viewElevation).toBeCloseTo(0.18, 8);
    expect(revealStart.viewElevation).toBeCloseTo(0.18, 8);
    expect(overview.viewElevation).toBeCloseTo(0.45, 8);
    expect(entry.viewElevation).toBeCloseTo(0.08, 8);
    expect(outside.viewElevation!).toBe(revealStart.viewElevation!);
    expect(revealStart.viewElevation!).toBeLessThan(overview.viewElevation!);
    expect(overview.viewElevation!).toBeGreaterThan(entry.viewElevation!);

    let previousElevation = revealStart.viewElevation!;

    for (
      let distance = GALACTIC_APPROACH_PIVOT_START_DISTANCE - 50;
      distance >= MILKY_WAY_NAVIGATION_DISTANCE;
      distance -= 50
    ) {
      const elevation = sampleGalacticApproach(distance).viewElevation!;

      expect(elevation).toBeGreaterThanOrEqual(previousElevation);
      previousElevation = elevation;
    }

    previousElevation = overview.viewElevation!;

    for (
      let distance = MILKY_WAY_NAVIGATION_DISTANCE - 50;
      distance >= GALACTIC_APPROACH_VIEW_END_DISTANCE;
      distance -= 50
    ) {
      const elevation = sampleGalacticApproach(distance).viewElevation!;

      expect(elevation).toBeLessThanOrEqual(previousElevation);
      previousElevation = elevation;
    }
  });

  it('reste neutre hors de la traversée galactique et pour les distances invalides', () => {
    for (const distance of [0, 519, 17_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sampleGalacticApproach(distance).active).toBe(false);
      expect(sampleGalacticApproach(distance).viewElevation).toBeNull();
    }
  });

  it('tolère les arrondis flottants aux bornes sans exposer la molette aux cibles parasites', () => {
    expect(sampleGalacticApproach(GALACTIC_APPROACH_OUTER_DISTANCE + 1e-9).active).toBe(true);
    expect(sampleGalacticApproach(GALACTIC_APPROACH_VIEW_END_DISTANCE - 1e-9).active).toBe(true);
    expect(sampleGalacticApproach(GALACTIC_APPROACH_OUTER_DISTANCE + 0.01).active).toBe(false);
    expect(sampleGalacticApproach(GALACTIC_APPROACH_VIEW_END_DISTANCE - 0.01).active).toBe(false);
  });
});
