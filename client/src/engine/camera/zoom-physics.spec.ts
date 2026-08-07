import {
  advanceNavigationZoomCoordinate,
  calculateNavigationZoomCoordinate,
  calculatePerspectiveDistance,
  calculatePerspectiveVisibleHeight,
  equivalentWheelDeltaForOctaves,
  logarithmicScaleChangeFromWheelDelta,
  resolveNavigationZoomCoordinate,
  softLimitWheelDelta,
  wheelDeltaForLogarithmicScaleChange,
  zoomScaleFromWheelDelta,
} from './zoom-physics';

describe('zoom physics', () => {
  it('exprime le changement de distance dans un espace logarithmique invariant d’échelle', () => {
    const oneOctave = equivalentWheelDeltaForOctaves(1);

    expect(zoomScaleFromWheelDelta(oneOctave)).toBeCloseTo(2, 12);
    expect(zoomScaleFromWheelDelta(-oneOctave)).toBeCloseTo(0.5, 12);
  });

  it('compose les incréments et rend un aller-retour exactement réciproque', () => {
    const deltaY = 137;
    const halfStep = zoomScaleFromWheelDelta(deltaY / 2);

    expect(halfStep * halfStep).toBeCloseTo(zoomScaleFromWheelDelta(deltaY), 12);
    expect(zoomScaleFromWheelDelta(deltaY) * zoomScaleFromWheelDelta(-deltaY)).toBeCloseTo(1, 12);
  });

  it('utilise l’étendue visible comme grandeur de zoom indépendante du champ de vue', () => {
    const distance = 24;
    const fieldOfView = 48;
    const visibleHeight = calculatePerspectiveVisibleHeight(distance, fieldOfView);

    expect(visibleHeight).toBeCloseTo(21.3709768948, 10);
    expect(calculatePerspectiveDistance(visibleHeight, fieldOfView)).toBeCloseTo(distance, 12);
    expect(calculatePerspectiveVisibleHeight(0, fieldOfView)).toBe(0);
    expect(calculatePerspectiveVisibleHeight(distance, 180)).toBe(0);
    expect(calculatePerspectiveDistance(Number.NaN, fieldOfView)).toBe(0);
    expect(calculatePerspectiveDistance(visibleHeight, -1)).toBe(0);
  });

  it('convertit sans perte entre entrée normalisée et déplacement logarithmique', () => {
    const deltaY = -137.25;
    const logarithmicAmount = logarithmicScaleChangeFromWheelDelta(deltaY);

    expect(wheelDeltaForLogarithmicScaleChange(logarithmicAmount)).toBeCloseTo(deltaY, 12);
    expect(logarithmicScaleChangeFromWheelDelta(Number.NaN)).toBe(0);
    expect(wheelDeltaForLogarithmicScaleChange(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('représente zoom et traversée minimale sur une seule coordonnée continue', () => {
    const minimumDistance = 0.3584;
    const maximumDistance = 600_000;
    const initialCoordinate = calculateNavigationZoomCoordinate(0.8, minimumDistance);
    const atMinimum = resolveNavigationZoomCoordinate(0, minimumDistance, maximumDistance);
    const insideTraversal = resolveNavigationZoomCoordinate(
      -0.75,
      minimumDistance,
      maximumDistance,
    );

    expect(initialCoordinate).toBeCloseTo(Math.log(0.8 / minimumDistance), 12);
    expect(atMinimum).toMatchObject({
      coordinate: 0,
      distance: minimumDistance,
      minimumTraversalLogarithmicAmount: 0,
      atMaximum: false,
    });
    expect(insideTraversal).toMatchObject({
      coordinate: -0.75,
      distance: minimumDistance,
      minimumTraversalLogarithmicAmount: 0.75,
      atMaximum: false,
    });
    expect(calculateNavigationZoomCoordinate(minimumDistance, minimumDistance, 0.75)).toBeCloseTo(
      -0.75,
      12,
    );
  });

  it('reste indépendant du découpage des événements et réversible hors saturation', () => {
    const minimumDistance = 0.3584;
    const maximumDistance = 600_000;
    const initialCoordinate = calculateNavigationZoomCoordinate(24, minimumDistance);
    const singleStep = advanceNavigationZoomCoordinate(
      initialCoordinate,
      -480,
      minimumDistance,
      maximumDistance,
    );
    let splitStep = resolveNavigationZoomCoordinate(
      initialCoordinate,
      minimumDistance,
      maximumDistance,
    );

    for (let index = 0; index < 4; index += 1) {
      splitStep = advanceNavigationZoomCoordinate(
        splitStep.coordinate,
        -120,
        minimumDistance,
        maximumDistance,
      );
    }
    expect(splitStep.coordinate).toBeCloseTo(singleStep.coordinate, 12);
    expect(splitStep.distance).toBeCloseTo(singleStep.distance, 12);

    const roundTrip = advanceNavigationZoomCoordinate(
      singleStep.coordinate,
      480,
      minimumDistance,
      maximumDistance,
    );

    expect(roundTrip.coordinate).toBeCloseTo(initialCoordinate, 12);
    expect(roundTrip.distance).toBeCloseTo(24, 12);
  });

  it('prédit que la trace Pluto doit rester au seuil tant que sa dette n’est pas rembobinée', () => {
    const inwardDeltaY = -717.4905098585081;
    const outwardDeltaY = 483.47662709892654;
    const minimumDistance = 0.3584;
    const maximumDistance = 600_000;
    const afterInward = advanceNavigationZoomCoordinate(
      0,
      inwardDeltaY,
      minimumDistance,
      maximumDistance,
    );
    const afterPartialReverse = advanceNavigationZoomCoordinate(
      afterInward.coordinate,
      outwardDeltaY,
      minimumDistance,
      maximumDistance,
    );

    expect(afterInward.minimumTraversalLogarithmicAmount).toBeCloseTo(1.0762357648, 10);
    expect(afterPartialReverse.distance).toBe(minimumDistance);
    expect(afterPartialReverse.minimumTraversalLogarithmicAmount).toBeCloseTo(0.3510208241, 10);
  });

  it('borne la coordonnée à la distance maximale et assainit les distances invalides', () => {
    const saturated = resolveNavigationZoomCoordinate(100, 2, 20);
    const sanitized = resolveNavigationZoomCoordinate(Number.NaN, Number.NaN, -1);

    expect(saturated.distance).toBeCloseTo(20, 12);
    expect(saturated.coordinate).toBeCloseTo(Math.log(10), 12);
    expect(saturated.atMaximum).toBe(true);
    expect(sanitized.distance).toBe(Number.EPSILON);
    expect(sanitized.minimumTraversalLogarithmicAmount).toBe(0);
  });

  it('conserve une zone linéaire puis sature continûment sans dépasser la capacité', () => {
    expect(softLimitWheelDelta(12, 60)).toBe(12);
    expect(softLimitWheelDelta(-12, 60)).toBe(-12);
    expect(softLimitWheelDelta(10_000, 60)).toBeCloseTo(60, 12);
    expect(softLimitWheelDelta(-10_000, 60)).toBeCloseTo(-60, 12);
  });
});
