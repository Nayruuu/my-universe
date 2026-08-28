import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { MilkyWayVolume } from './milky-way-volume';

describe('MilkyWayVolume', () => {
  it('conserve l’API de scène sans construire une seconde représentation de la Voie lactée', () => {
    const volume = new MilkyWayVolume();

    expect(volume.atlasStatus).toBe('point-cloud');
    expect(volume.root.children).toHaveLength(0);
    expect(volume.root.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      rasterAtlas: 'none',
      surfaceGeometry: 'none',
      primaryRepresentation: 'deterministic-galactocentric-batched-point-cloud',
      depthTechnique: 'point-cloud-only',
      apparentScaleTreatment: 'shared-canonical-galactic-metric-for-disc-and-solar-position',
      physicalDiameterLightYears: 100_000,
      authoringDiameter: 11_400,
      transitionRepresentation:
        'one-galactocentric-point-population-from-exterior-silhouette-to-stellar-traversal',
    });
    expect(volume.visibleSurfaceLayerCount).toBe(0);
    expect(volume.proceduralVolumeVisible).toBe(false);
    expect(volume.drawMeshCount).toBe(0);

    volume.setQuality('high');
    volume.update(3_600, 1.2, true);
    const galacticScale = calculateMilkyWaySceneScale(3_600);

    expect(volume.root.visible).toBe(false);
    expect(volume.root.scale.x).toBeCloseTo(galacticScale.modelScale, 8);
    expect(volume.root.userData).toMatchObject({
      quality: 'high',
      worldDiameter: galacticScale.worldDiameter,
      requestedGalaxyRadiance: 1.2,
      requestedActive: true,
      volumeLayerOpacity: 0,
    });

    volume.update(17_000, 0.4, false);
    expect(volume.root.visible).toBe(false);
    expect(volume.proceduralVolumeVisible).toBe(false);
    expect(volume.drawMeshCount).toBe(0);
    expect(volume.root.userData).toMatchObject({
      requestedGalaxyRadiance: 0.4,
      requestedActive: false,
    });

    volume.dispose();
    volume.dispose();
    expect(volume.root.children).toHaveLength(0);
  });
});
