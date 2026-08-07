import {
  PARIS_EIFFEL_RENDERED_HEIGHT_PX,
  PARIS_EIFFEL_TOWER_HEIGHT_METERS,
  PARIS_LANDMARKS,
  projectParisLandmarkLayouts,
} from './earth-paris-landmarks';

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
  });

  it('neutralise une échelle de projection non finie ou nulle', () => {
    const fallback = projectParisLandmarkLayouts(1);

    expect(projectParisLandmarkLayouts(Number.NaN)).toEqual(fallback);
    expect(projectParisLandmarkLayouts(0)).toEqual(fallback);
  });
});
