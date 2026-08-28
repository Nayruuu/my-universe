import { calculateGalacticFrameScale } from './galaxy-scale-model';
import {
  calculateStellarNeighborhoodReveal,
  calculateStellarNeighborhoodSceneScale,
  GALACTIC_STELLAR_NEIGHBORHOOD_SCALE,
  STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS,
  STELLAR_NEIGHBORHOOD_EXPANSION_END,
  STELLAR_NEIGHBORHOOD_EXPANSION_START,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
  STELLAR_NEIGHBORHOOD_REVEAL_START,
  interpolateStellarNeighborhoodLodValue,
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

  it('interpole les styles de rendu sans dépendre du basculement LOD médian', () => {
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 1)).toBe(10);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.75)).toBe(15);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.5)).toBe(20);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0.25)).toBe(12);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 0)).toBe(4);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, 2)).toBe(10);
    expect(interpolateStellarNeighborhoodLodValue(10, 20, 4, -1)).toBe(4);
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
      reveal: 1,
    });
    expect(middle.radialScale).toBeGreaterThan(galactic.radialScale);
    expect(middle.radialScale).toBeLessThan(local.radialScale);
    expect(galactic.radialScale).toBeCloseTo(GALACTIC_STELLAR_NEIGHBORHOOD_SCALE, 8);
    expect(galactic.verticalScale).toBeLessThan(galactic.radialScale);
    expect(galactic.physicalRadialScale).toBeGreaterThan(0);
    expect(galactic.maximumContainedRadialScale).toBeGreaterThan(0);
    expect(galactic.maximumContainedVerticalScale).toBeGreaterThan(0);
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
    ]) {
      const before = calculateStellarNeighborhoodSceneScale(boundary - 0.001, 736.02);
      const after = calculateStellarNeighborhoodSceneScale(boundary + 0.001, 736.02);

      expect(Math.abs(after.radialScale - before.radialScale)).toBeLessThan(0.000_1);
      expect(Math.abs(after.verticalScale - before.verticalScale)).toBeLessThan(0.000_1);
      expect(Math.abs(after.reveal - before.reveal)).toBeLessThan(0.000_1);
    }
  });
});
