import {
  PARIS_EIFFEL_RENDERED_HEIGHT_PX,
  PARIS_EIFFEL_TOWER_HEIGHT_METERS,
  PARIS_EIFFEL_VISUAL_SCALE,
  PARIS_LANDMARKS,
  projectParisLandmarkLayouts,
} from './earth-paris-landmarks';
import { PARIS_DECORATIVE_SKYLINE_MAX_HEIGHT_UNITS } from './earth-paris-cityscape';

describe('proportions documentées des monuments parisiens', () => {
  it('conserve les hauteurs publiées par les sources institutionnelles', () => {
    expect(
      Object.fromEntries(PARIS_LANDMARKS.map(({ id, heightMeters }) => [id, heightMeters])),
    ).toEqual({
      'notre-dame': 69,
      montparnasse: 210,
      'grande-arche': 110,
      'arc-de-triomphe': 49.54,
      'sacre-coeur': 83,
    });
    expect(PARIS_EIFFEL_TOWER_HEIGHT_METERS).toBe(330);
  });

  it('projette chaque édifice au même ratio vertical que la Tour Eiffel', () => {
    for (const panoramaUnitsPerRenderedPixel of [0.65, 1.35, 2.4]) {
      const layouts = projectParisLandmarkLayouts(panoramaUnitsPerRenderedPixel);

      for (const layout of layouts) {
        const renderedHeight = layout.height / panoramaUnitsPerRenderedPixel;

        expect(renderedHeight / PARIS_EIFFEL_RENDERED_HEIGHT_PX).toBeCloseTo(
          layout.heightMeters / PARIS_EIFFEL_TOWER_HEIGHT_METERS,
          8,
        );
      }
    }
  });

  it('donne à la Tour Eiffel une présence nettement supérieure au décor arrière', () => {
    const referencePanoramaUnitsPerPixel = 1.43;
    const rearSkylineHeightPixels =
      PARIS_DECORATIVE_SKYLINE_MAX_HEIGHT_UNITS / referencePanoramaUnitsPerPixel;

    expect(PARIS_EIFFEL_VISUAL_SCALE).toBe(2.16);
    expect(PARIS_EIFFEL_RENDERED_HEIGHT_PX).toBeCloseTo(190.08, 8);
    expect(PARIS_EIFFEL_RENDERED_HEIGHT_PX / rearSkylineHeightPixels).toBeGreaterThanOrEqual(3);
  });

  it('préserve les proportions des silhouettes sans étirement horizontal', () => {
    const layouts = projectParisLandmarkLayouts(1.35);

    for (const layout of layouts) {
      expect(layout.width / layout.height).toBeCloseTo(layout.sourceAspectRatio, 8);
    }
  });

  it('sépare le relief de Montmartre de la hauteur du Sacré-Cœur', () => {
    const unitsPerPixel = 1.35;
    const sacreCoeur = projectParisLandmarkLayouts(unitsPerPixel).find(
      ({ id }) => id === 'sacre-coeur',
    );

    expect(sacreCoeur).toBeDefined();
    expect(sacreCoeur!.baseElevationMeters).toBe(130);
    expect(sacreCoeur!.y + sacreCoeur!.height).toBeCloseTo(
      320 -
        (130 / PARIS_EIFFEL_TOWER_HEIGHT_METERS) * PARIS_EIFFEL_RENDERED_HEIGHT_PX * unitsPerPixel,
      8,
    );
    expect(sacreCoeur!.terrainPath).toContain('C');
    expect(
      projectParisLandmarkLayouts(unitsPerPixel)
        .filter(({ id }) => id !== 'sacre-coeur')
        .every(({ terrainPath }) => terrainPath === null),
    ).toBe(true);
  });

  it('neutralise une échelle de projection non finie ou nulle', () => {
    const fallback = projectParisLandmarkLayouts(1);

    expect(projectParisLandmarkLayouts(Number.NaN)).toEqual(fallback);
    expect(projectParisLandmarkLayouts(0)).toEqual(fallback);
  });
});
