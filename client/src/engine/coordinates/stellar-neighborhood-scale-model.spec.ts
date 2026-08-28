import { calculateGalacticFrameScale } from './galaxy-scale-model';
import {
  calculateActiveStellarDetailReveal,
  calculatePlanetarySystemReveal,
  calculateStellarNeighborhoodReveal,
  calculateStellarNeighborhoodSceneScale,
  GALACTIC_STELLAR_NEIGHBORHOOD_SCALE,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
  STELLAR_NEIGHBORHOOD_EXPANSION_END,
  STELLAR_NEIGHBORHOOD_EXPANSION_START,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
  interpolateStellarNeighborhoodLodValue,
  PLANETARY_SYSTEM_REVEAL_INNER_DISTANCE,
  PLANETARY_SYSTEM_REVEAL_OUTER_DISTANCE,
} from './stellar-neighborhood-scale-model';

describe('stellar neighborhood scale model', () => {
  it('révèle continûment le catalogue local pendant la plongée dans la Voie lactée', () => {
    const local = calculateStellarNeighborhoodReveal(STELLAR_NEIGHBORHOOD_REVEAL_START);
    const middle = calculateStellarNeighborhoodReveal(
      Math.sqrt(STELLAR_NEIGHBORHOOD_REVEAL_START * STELLAR_NEIGHBORHOOD_REVEAL_END),
    );
    const galactic = calculateStellarNeighborhoodReveal(STELLAR_NEIGHBORHOOD_REVEAL_END);

    expect(local).toBe(1);
    expect(middle).toBeCloseTo(0.5, 8);
    expect(galactic).toBe(0);
    expect(calculateStellarNeighborhoodReveal(0)).toBe(1);
    expect(calculateStellarNeighborhoodReveal(Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateStellarNeighborhoodReveal(Number.NEGATIVE_INFINITY)).toBe(1);
    expect(calculateStellarNeighborhoodReveal(Number.NaN)).toBe(1);
  });

  it('réserve une étape interstellaire avant les planètes, leurs orbites et leurs labels', () => {
    for (const distance of [2_200, 1_600, 900, 600, 400, PLANETARY_SYSTEM_REVEAL_OUTER_DISTANCE]) {
      const stars = calculateStellarNeighborhoodReveal(distance);

      expect(calculatePlanetarySystemReveal(stars)).toBe(0);
    }
    expect(calculateStellarNeighborhoodReveal(600)).toBeCloseTo(0.0821039, 7);
    expect(calculatePlanetarySystemReveal(calculateStellarNeighborhoodReveal(220))).toBeCloseTo(
      0.053555,
      7,
    );
    expect(calculatePlanetarySystemReveal(calculateStellarNeighborhoodReveal(150))).toBeCloseTo(
      0.7546813,
      7,
    );
    expect(
      calculatePlanetarySystemReveal(
        calculateStellarNeighborhoodReveal(PLANETARY_SYSTEM_REVEAL_INNER_DISTANCE),
      ),
    ).toBe(1);
    expect(calculatePlanetarySystemReveal(-1)).toBe(0);
    expect(calculatePlanetarySystemReveal(2)).toBe(1);
    expect(calculatePlanetarySystemReveal(Number.NaN)).toBe(0);
    expect(calculatePlanetarySystemReveal(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(calculatePlanetarySystemReveal(Number.POSITIVE_INFINITY)).toBe(1);

    let previous = 0;

    for (let step = 0; step <= 100; step += 1) {
      const distance = 240 * Math.pow(90 / 240, step / 100);
      const reveal = calculatePlanetarySystemReveal(calculateStellarNeighborhoodReveal(distance));

      expect(reveal).toBeGreaterThanOrEqual(previous);
      expect(reveal - previous).toBeLessThan(0.022);
      previous = reveal;
    }
    for (const boundary of [90, 240]) {
      const before = calculatePlanetarySystemReveal(
        calculateStellarNeighborhoodReveal(boundary - 0.001),
      );
      const after = calculatePlanetarySystemReveal(
        calculateStellarNeighborhoodReveal(boundary + 0.001),
      );

      expect(Math.abs(before - after)).toBeLessThan(0.000_001);
    }
  });

  it('préserve la lisibilité du détail actif indépendamment du fondu prolongé du catalogue', () => {
    expect(calculateActiveStellarDetailReveal(2_200)).toBe(0);
    expect(calculateActiveStellarDetailReveal(800)).toBeCloseTo(0.78568575, 8);
    expect(calculateActiveStellarDetailReveal(800)).toBeGreaterThan(
      calculateStellarNeighborhoodReveal(800),
    );
    expect(calculateActiveStellarDetailReveal(520)).toBe(1);
    expect(calculateActiveStellarDetailReveal(220)).toBe(1);
    expect(calculateActiveStellarDetailReveal(Number.POSITIVE_INFINITY)).toBe(0);
    expect(calculateActiveStellarDetailReveal(Number.NaN)).toBe(1);
  });

  it('interpole les styles de rendu sans dépendre du basculement LOD médian', () => {
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 1)).toBe(10);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.75)).toBe(15);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.5)).toBe(20);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.25)).toBe(12);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0)).toBe(4);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 2)).toBe(10);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, -1)).toBe(4);
  });

  it('réserve l’entrée au nuage puis étale HYG/Gaia sur une décennie sans déplacer les catalogues', () => {
    const logarithmicSpan = Math.log(
      STELLAR_NEIGHBORHOOD_REVEAL_END / STELLAR_NEIGHBORHOOD_REVEAL_START,
    );

    expect(logarithmicSpan).toBeCloseTo(Math.log(10), 8);
    expect(calculateStellarNeighborhoodReveal(1_400)).toBe(0);
    expect(calculateStellarNeighborhoodReveal(900)).toBe(0);
    expect(calculateStellarNeighborhoodReveal(600)).toBeLessThan(0.1);
    expect(calculateStellarNeighborhoodReveal(400)).toBeCloseTo(0.2847334, 7);
    expect(calculateStellarNeighborhoodReveal(220)).toBeCloseTo(0.6649334, 7);
    expect(calculateStellarNeighborhoodReveal(90)).toBe(1);
    let previousReveal = 0;

    for (let step = 0; step <= 100; step += 1) {
      const distance = 900 * Math.pow(0.1, step / 100);
      const scale = calculateStellarNeighborhoodSceneScale(distance, 736.02);

      expect(scale.radialScale).toBe(1);
      expect(scale.verticalScale).toBe(1);
      expect(scale.originScale).toBe(1);
      expect(scale.reveal).toBeGreaterThanOrEqual(previousReveal);
      expect(scale.reveal - previousReveal).toBeLessThan(0.016);
      previousReveal = scale.reveal;
    }
  });

  it('ne révèle le catalogue qu’après l’entrée de la caméra dans son volume lisible', () => {
    const firstInteriorDistance = STELLAR_NEIGHBORHOOD_REVEAL_END * 0.9;
    const sceneScale = calculateStellarNeighborhoodSceneScale(firstInteriorDistance, 736.02);
    const visibleRadius = sceneScale.radialScale * STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS;

    expect(calculateStellarNeighborhoodReveal(STELLAR_NEIGHBORHOOD_REVEAL_END)).toBe(0);
    expect(calculateStellarNeighborhoodReveal(firstInteriorDistance)).toBeGreaterThan(0);
    expect(visibleRadius).toBeGreaterThan(firstInteriorDistance);
  });

  it('passe d’un voisinage lisible à un volume contenu dans le disque galactique', () => {
    const local = calculateStellarNeighborhoodSceneScale(
      STELLAR_NEIGHBORHOOD_EXPANSION_START,
      736.02,
    );
    const middle = calculateStellarNeighborhoodSceneScale(
      Math.sqrt(STELLAR_NEIGHBORHOOD_EXPANSION_START * STELLAR_NEIGHBORHOOD_EXPANSION_END),
      736.02,
    );
    const galactic = calculateStellarNeighborhoodSceneScale(
      STELLAR_NEIGHBORHOOD_EXPANSION_END,
      736.02,
    );

    expect(local).toMatchObject({
      radialScale: 1,
      verticalScale: 1,
      originScale: 1,
      reveal: 0,
    });
    expect(middle.radialScale).toBeGreaterThan(galactic.radialScale);
    expect(middle.radialScale).toBeLessThan(local.radialScale);
    expect(galactic.radialScale).toBeCloseTo(GALACTIC_STELLAR_NEIGHBORHOOD_SCALE, 8);
    expect(galactic.verticalScale).toBeLessThan(galactic.radialScale);
    expect(galactic.physicalRadialScale).toBeGreaterThan(0);
    expect(galactic.maximumContainedRadialScale).toBeGreaterThan(0);
    expect(galactic.maximumContainedVerticalScale).toBeGreaterThan(0);
  });

  it('termine le changement d’échelle avant de rendre les étoiles locales visibles', () => {
    const revealMiddle = Math.sqrt(
      STELLAR_NEIGHBORHOOD_REVEAL_START * STELLAR_NEIGHBORHOOD_REVEAL_END,
    );

    for (const distance of [
      STELLAR_NEIGHBORHOOD_REVEAL_START,
      revealMiddle,
      STELLAR_NEIGHBORHOOD_REVEAL_END,
    ]) {
      const scale = calculateStellarNeighborhoodSceneScale(distance, 736.02);

      expect(scale.radialScale).toBe(1);
      expect(scale.verticalScale).toBe(1);
    }

    const hiddenTransition = calculateStellarNeighborhoodSceneScale(
      Math.sqrt(STELLAR_NEIGHBORHOOD_EXPANSION_START * STELLAR_NEIGHBORHOOD_EXPANSION_END),
      736.02,
    );

    expect(hiddenTransition.reveal).toBe(0);
    expect(hiddenTransition.radialScale).toBeGreaterThan(GALACTIC_STELLAR_NEIGHBORHOOD_SCALE);
    expect(hiddenTransition.radialScale).toBeLessThan(1);
    expect(STELLAR_NEIGHBORHOOD_REVEAL_END).toBeLessThan(STELLAR_NEIGHBORHOOD_EXPANSION_START);
    const hiddenBuffer = calculateStellarNeighborhoodSceneScale(
      (STELLAR_NEIGHBORHOOD_REVEAL_END + STELLAR_NEIGHBORHOOD_EXPANSION_START) / 2,
      736.02,
    );

    expect(hiddenBuffer.reveal).toBe(0);
    expect(hiddenBuffer.radialScale).toBe(1);
    expect(hiddenBuffer.verticalScale).toBe(1);
  });

  it('applique au Soleil et à son voisinage la même origine galactique', () => {
    for (const distance of [700, 1_050, 1_400, 17_000]) {
      expect(calculateStellarNeighborhoodSceneScale(distance, 736.02).originScale).toBeCloseTo(
        calculateGalacticFrameScale(distance),
        10,
      );
    }

    const negativeOrigin = calculateStellarNeighborhoodSceneScale(1_400, -100);
    const invalidOrigin = calculateStellarNeighborhoodSceneScale(1_400, Number.NaN);

    expect(negativeOrigin.maximumContainedRadialScale).toBeCloseTo(
      invalidOrigin.maximumContainedRadialScale,
      10,
    );
  });

  it('ne crée aucun saut aux bornes de la transition stellaire', () => {
    for (const boundary of [
      STELLAR_NEIGHBORHOOD_EXPANSION_START,
      STELLAR_NEIGHBORHOOD_EXPANSION_END,
      STELLAR_NEIGHBORHOOD_REVEAL_END,
      STELLAR_NEIGHBORHOOD_REVEAL_START,
    ]) {
      const before = calculateStellarNeighborhoodSceneScale(boundary - 0.001, 736.02);
      const after = calculateStellarNeighborhoodSceneScale(boundary + 0.001, 736.02);

      expect(Math.abs(after.radialScale - before.radialScale)).toBeLessThan(0.000_1);
      expect(Math.abs(after.verticalScale - before.verticalScale)).toBeLessThan(0.000_1);
      expect(Math.abs(after.reveal - before.reveal)).toBeLessThan(0.000_1);
    }
  });
});
