import {
  calculateIntergalacticScale,
  COSMIC_WEB_SCALE_DISTANCE,
  LOCAL_GROUP_SCALE_DISTANCE,
  NEARBY_UNIVERSE_SCALE_DISTANCE,
} from './intergalactic-scale-model';

describe('intergalactic scale model', () => {
  it('utilise une seule métrique linéaire dans les trois référentiels', () => {
    const localGroup = calculateIntergalacticScale(LOCAL_GROUP_SCALE_DISTANCE);
    const nearbyUniverse = calculateIntergalacticScale(NEARBY_UNIVERSE_SCALE_DISTANCE);
    const cosmicWeb = calculateIntergalacticScale(COSMIC_WEB_SCALE_DISTANCE);

    expect(localGroup.sceneUnitsPerMegaparsec).toBe(10_000);
    expect(localGroup.localGroupScale).toBe(1);
    expect(localGroup.nearbyUniverseScale).toBe(2.5);
    expect(localGroup.cosmicWebScale).toBe(50);
    expect(nearbyUniverse.sceneUnitsPerMegaparsec).toBe(4_000);
    expect(nearbyUniverse.localGroupScale).toBe(0.4);
    expect(nearbyUniverse.nearbyUniverseScale).toBe(1);
    expect(nearbyUniverse.cosmicWebScale).toBe(20);
    expect(cosmicWeb.sceneUnitsPerMegaparsec).toBe(200);
    expect(cosmicWeb.localGroupScale).toBe(0.02);
    expect(cosmicWeb.nearbyUniverseScale).toBe(0.05);
    expect(cosmicWeb.cosmicWebScale).toBe(1);
  });

  it('préserve les rapports publiés entre M31, M81 et M87 à chaque échelle', () => {
    // Independent reference distances used by the local catalogues:
    // McConnachie (2012), Karachentsev et al. (2013), and Mei et al. (2007).
    const m31DistanceMpc = 0.783;
    const m81DistanceMpc = 3.63;
    const m87DistanceMpc = 17.219;

    for (const cameraDistance of [
      LOCAL_GROUP_SCALE_DISTANCE,
      50_000,
      NEARBY_UNIVERSE_SCALE_DISTANCE,
      200_000,
      COSMIC_WEB_SCALE_DISTANCE,
    ]) {
      const scale = calculateIntergalacticScale(cameraDistance).sceneUnitsPerMegaparsec;
      const m31SceneDistance = m31DistanceMpc * scale;
      const m81SceneDistance = m81DistanceMpc * scale;
      const m87SceneDistance = m87DistanceMpc * scale;

      expect(m81SceneDistance / m31SceneDistance).toBeCloseTo(4.636_015, 5);
      expect(m87SceneDistance / m31SceneDistance).toBeCloseTo(21.991_06, 5);
    }
  });

  it('reste continu aux deux transitions sémantiques', () => {
    for (const boundary of [NEARBY_UNIVERSE_SCALE_DISTANCE, COSMIC_WEB_SCALE_DISTANCE]) {
      const before = calculateIntergalacticScale(boundary - 0.01).sceneUnitsPerMegaparsec;
      const after = calculateIntergalacticScale(boundary + 0.01).sceneUnitsPerMegaparsec;

      expect(Math.abs(after - before)).toBeLessThan(0.01);
    }
    expect(calculateIntergalacticScale(Number.NaN).referenceFrameBlend).toBe('local-group');
  });
});
