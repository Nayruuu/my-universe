import { SemanticZoomJourney } from './semantic-zoom';

describe('SemanticZoomJourney', () => {
  it('parcourt les sept échelles et la limite extérieure puis revient exactement à son ancre', () => {
    const journey = new SemanticZoomJourney();
    let distance = 4.8;

    for (const expected of [520, 1_400, 3_600, 17_000, 120_000, 420_000, 600_000]) {
      const step = journey.step(distance, 480);

      expect(step.handled).toBe(true);
      expect(step.distance).toBeCloseTo(expected, 6);
      distance = step.distance;
    }
    expect(journey.active).toBe(true);

    for (const expected of [420_000, 120_000, 17_000, 3_600, 1_400, 520, 4.8]) {
      const step = journey.step(distance, -480);

      expect(step.handled).toBe(true);
      expect(step.distance).toBeCloseTo(expected, 6);
      distance = step.distance;
    }
    expect(journey.active).toBe(false);
  });

  it('utilise le cadrage courant comme ancre et ignore un rapprochement sans trajet', () => {
    const journey = new SemanticZoomJourney();

    expect(journey.step(24, -120)).toEqual({
      handled: false,
      distance: 24,
    });
    expect(journey.step(24, 480).distance).toBeCloseTo(520, 6);

    journey.reset();

    expect(journey.active).toBe(false);
    expect(journey.step(800, 480).distance).toBeCloseTo(1_400, 6);

    journey.reset();

    expect(journey.step(4.799999999999999, 480).distance).toBeCloseTo(520, 6);
  });

  it('ne crée pas un trajet bloqué lorsqu’aucune échelle extérieure ne reste', () => {
    const journey = new SemanticZoomJourney();

    expect(journey.step(600_000, 480)).toEqual({
      handled: false,
      distance: 600_000,
    });
    expect(journey.active).toBe(false);
    expect(journey.step(600_000, -480)).toEqual({
      handled: false,
      distance: 600_000,
    });
  });

  it('interpole les gestes fins, borne les extrêmes et rejette les deltas invalides', () => {
    const journey = new SemanticZoomJourney();

    expect(journey.step(4.8, 0)).toEqual({
      handled: false,
      distance: 4.8,
    });
    expect(journey.step(4.8, Number.NaN)).toEqual({
      handled: false,
      distance: 4.8,
    });
    expect(journey.step(Number.NaN, 480).distance).toBe(520);
    journey.reset();

    const halfway = journey.step(4.8, 240);

    expect(halfway.distance).toBeGreaterThan(4.8);
    expect(halfway.distance).toBeLessThan(520);
    expect(journey.step(halfway.distance, 10_000).distance).toBe(600_000);
    expect(journey.step(600_000, 480)).toEqual({
      handled: false,
      distance: 600_000,
    });
    expect(journey.active).toBe(false);
    expect(journey.step(600_000, -10_000)).toEqual({
      handled: false,
      distance: 600_000,
    });
  });

  it('restitue le surplus lorsque le geste traverse son ancre intérieure', () => {
    const journey = new SemanticZoomJourney();
    const outward = journey.step(24, 1);
    const inward = journey.step(outward.distance, -121);

    expect(inward.distance).toBe(24);
    expect(inward.remainingDeltaY).toBeCloseTo(-120, 12);
    expect(journey.active).toBe(false);
  });
});
