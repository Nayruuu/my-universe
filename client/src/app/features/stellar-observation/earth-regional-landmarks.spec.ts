import {
  EARTH_REGIONAL_LANDMARKS,
  projectEarthRegionalLandmarkLayouts,
} from './earth-regional-landmarks';

describe('repères documentés des panoramas urbains internationaux', () => {
  const expectedHeights = {
    'new-york': [541.3, 443.2, 318.9, 84.3],
    tokyo: [634, 333, 243, 203.7],
    london: [309.6, 180, 111, 65],
    sydney: [309, 271.3, 244, 134],
    cairo: [393.8, 187, 84, 68],
    rio: [163, 135, 75, 62],
    seoul: [555, 249, 228, 24],
  } as const;

  it('fournit quatre silhouettes reconnaissables et sourcées par ville', () => {
    for (const [kind, heights] of Object.entries(expectedHeights)) {
      const landmarks = EARTH_REGIONAL_LANDMARKS.filter(
        (landmark) => landmark.cityscapeKind === kind,
      );

      expect(landmarks).toHaveLength(4);
      expect(landmarks.map(({ heightMeters }) => heightMeters)).toEqual(heights);
      expect(landmarks.every(({ sourceUrl }) => sourceUrl.startsWith('https://'))).toBe(true);
      expect(landmarks.every(({ silhouettePath }) => silhouettePath.length > 30)).toBe(true);
      expect(new Set(landmarks.map(({ silhouettePath }) => silhouettePath)).size).toBe(4);
    }
  });

  it('projette les coordonnées géographiques sur le panorama circulaire', () => {
    for (const landmark of EARTH_REGIONAL_LANDMARKS) {
      const layout = projectEarthRegionalLandmarkLayouts(landmark.cityscapeKind, 1).find(
        ({ id }) => id === landmark.id,
      );

      expect(layout).toBeDefined();
      expect(layout!.centerX).toBeGreaterThanOrEqual(0);
      expect(layout!.centerX).toBeLessThan(7_200);
      expect(layout!.x).toBeCloseTo(layout!.centerX - layout!.width / 2, 8);
      expect(layout!.y + layout!.height).toBeCloseTo(320, 8);
    }
  });

  it('conserve les rapports de hauteur documentés dans chaque ville', () => {
    for (const kind of Object.keys(expectedHeights)) {
      const layouts = projectEarthRegionalLandmarkLayouts(
        kind as keyof typeof expectedHeights,
        1.35,
      );
      const reference = layouts[0]!;

      for (const layout of layouts.slice(1)) {
        expect(layout.height / reference.height).toBeCloseTo(
          layout.heightMeters / reference.heightMeters,
          8,
        );
        expect(layout.width / layout.height).toBeCloseTo(layout.sourceAspectRatio, 8);
      }
    }
  });

  it('ne crée aucun monument intégré pour Paris ou un horizon procédural', () => {
    expect(projectEarthRegionalLandmarkLayouts('paris', 1)).toEqual([]);
    expect(projectEarthRegionalLandmarkLayouts('procedural', 1)).toEqual([]);
  });

  it('neutralise une échelle de projection invalide', () => {
    expect(projectEarthRegionalLandmarkLayouts('new-york', Number.NaN)).toEqual(
      projectEarthRegionalLandmarkLayouts('new-york', 1),
    );
    expect(projectEarthRegionalLandmarkLayouts('new-york', 0)).toEqual(
      projectEarthRegionalLandmarkLayouts('new-york', 1),
    );
  });
});
