import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { MilkyWayVolumeVisual } from './milky-way-volume-visual';

describe('MilkyWayVolumeVisual', () => {
  it('ne rend aucune couche volumétrique distincte de la galaxie construite en points', () => {
    const visual = new MilkyWayVolumeVisual();

    expect(visual.root.children).toHaveLength(0);
    expect(visual.root.userData).toMatchObject({
      rasterAtlas: 'none',
      surfaceGeometry: 'none',
      scientificConfidence: 'illustrative',
      visualStructure: 'retired-volume-placeholder-for-point-built-galaxy',
      primaryRepresentation: 'deterministic-galactocentric-batched-point-cloud',
      morphologyModel: 'barred-spiral-with-two-major-and-two-minor-arms',
      apparentScaleTreatment: 'shared-canonical-galactic-metric-for-disc-and-solar-position',
      physicalDiameterLightYears: 100_000,
      authoringDiameter: 11_400,
      depthTechnique: 'point-cloud-only',
      proceduralTechnique: 'none',
      nearRepresentation: 'same-fixed-galactocentric-points-resolved-by-perspective-and-proximity',
      transitionRepresentation:
        'one-galactocentric-point-population-from-exterior-silhouette-to-stellar-traversal',
      proceduralVolumeOpacityFactor: 0,
      verticalStructure: 'thin-and-thick-disc-point-distribution',
      visualThicknessTreatment: 'point-density-envelope-only',
      interiorContinuity: 'fixed-point-cloud-through-galactic-and-stellar-catalogue-overlay',
      interiorClarityTreatment: 'same-points-resolve-by-local-proximity',
      integratedLightTreatment: 'none-separate-volume-retired',
      exteriorReadabilityTreatment: 'point-density-arms-and-bulge-with-dark-interarm-separation',
    });

    visual.setQuality('high');
    const localGroupScale = calculateMilkyWaySceneScale(17_000);

    visual.update(1.2, localGroupScale, true);

    expect(visual.root.visible).toBe(false);
    expect(visual.visibleSurfaceLayerCount).toBe(0);
    expect(visual.proceduralVolumeVisible).toBe(false);
    expect(visual.drawMeshCount).toBe(0);
    expect(visual.root.scale.x).toBeCloseTo(localGroupScale.modelScale, 8);
    expect(visual.root.userData).toMatchObject({
      quality: 'high',
      worldDiameter: localGroupScale.worldDiameter,
      physicalWorldDiameter: localGroupScale.physicalWorldDiameter,
      visualScaleFactor: localGroupScale.visualScaleFactor,
      visualSceneUnitsPerKiloparsec: localGroupScale.visualSceneUnitsPerKiloparsec,
      referenceFrameSceneUnitsPerKiloparsec: localGroupScale.referenceFrameSceneUnitsPerKiloparsec,
      referenceFrameBlend: 'intergalactic-to-galactic',
      surfaceLayerCount: 0,
      volumeLayerOpacity: 0,
      requestedGalaxyRadiance: 1.2,
      requestedActive: true,
    });

    visual.dispose();
    expect(visual.root.children).toHaveLength(0);
  });
});
