import * as THREE from 'three';
import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import {
  createMilkyWayVolumeSample,
  MilkyWayVolume,
  sampleMilkyWayVolume,
} from './milky-way-volume';

describe('MilkyWayVolume', () => {
  it('maintient le même objet procédural du Groupe local à l’échelle galactique', () => {
    const sample = createMilkyWayVolumeSample();

    expect(sampleMilkyWayVolume(0, sample).opacity).toBe(0);
    expect(sample.immersionOpacity).toBeCloseTo(0.0736, 6);

    sampleMilkyWayVolume(420, sample);
    expect(sample.opacity).toBeGreaterThan(0);
    expect(sample.opacity).toBeLessThan(0.01);
    expect(sample.immersionOpacity).toBeGreaterThan(0.15);
    expect(sample.immersionOpacity).toBeLessThan(0.16);

    sampleMilkyWayVolume(1_400, sample);
    expect(sample.opacity).toBeGreaterThan(0.2);
    expect(sample.opacity).toBeLessThan(0.21);
    expect(sample.immersionOpacity).toBeGreaterThan(0.03);
    expect(sample.immersionOpacity).toBeLessThan(0.04);

    expect(sampleMilkyWayVolume(1_800, sample).opacity).toBeGreaterThan(0.33);
    expect(sample.opacity).toBeLessThan(0.35);
    expect(sample.immersionOpacity).toBe(0);

    expect(sampleMilkyWayVolume(3_600, sample).opacity).toBeGreaterThan(0.89);
    expect(sample.opacity).toBeLessThan(0.9);
    expect(sample.immersionOpacity).toBe(0);

    for (const distance of [4_000, 9_600, 17_000, 120_000, 170_000]) {
      expect(sampleMilkyWayVolume(distance, sample).opacity).toBeCloseTo(0.92, 6);
      expect(sample.immersionOpacity).toBe(0);
    }

    expect(sampleMilkyWayVolume(5, sample).immersionOpacity).toBeCloseTo(0.0736, 6);
    expect(sampleMilkyWayVolume(70, sample).immersionOpacity).toBeGreaterThan(0);
    expect(sample.immersionOpacity).toBeLessThan(0.1);
    expect(sampleMilkyWayVolume(150, sample).immersionOpacity).toBeGreaterThan(0.09);
    expect(sample.immersionOpacity).toBeLessThan(0.1);
    expect(sampleMilkyWayVolume(260, sample).immersionOpacity).toBeGreaterThan(0.11);
    expect(sample.immersionOpacity).toBeLessThan(0.12);
    expect(sampleMilkyWayVolume(520, sample).immersionOpacity).toBeCloseTo(0.16, 6);
    expect(sampleMilkyWayVolume(900, sample).immersionOpacity).toBeGreaterThan(0.12);
    expect(sample.immersionOpacity).toBeLessThan(0.13);
    expect(sampleMilkyWayVolume(1_800, sample).immersionOpacity).toBe(0);

    const overviewTransition = sampleMilkyWayVolume(235_000, sample).opacity;

    expect(overviewTransition).toBeGreaterThan(0);
    expect(overviewTransition).toBeLessThan(0.92);
    expect(sampleMilkyWayVolume(300_000, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(Number.POSITIVE_INFINITY, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(Number.NEGATIVE_INFINITY, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(Number.NaN, sample).opacity).toBe(0);
    expect(sampleMilkyWayVolume(-1, sample).opacity).toBe(0);
    expect(sample.immersionOpacity).toBe(0);

    const before = sampleMilkyWayVolume(1_399, createMilkyWayVolumeSample()).opacity;
    const after = sampleMilkyWayVolume(1_401, createMilkyWayVolumeSample()).opacity;

    expect(Math.abs(after - before)).toBeLessThan(0.002);
    for (const boundary of [5, 260, 520, 1_800, 4_000, 170_000, 300_000]) {
      const beforeBoundary = sampleMilkyWayVolume(boundary - 0.01, createMilkyWayVolumeSample());
      const afterBoundary = sampleMilkyWayVolume(boundary + 0.01, createMilkyWayVolumeSample());

      expect(Math.abs(afterBoundary.opacity - beforeBoundary.opacity)).toBeLessThan(0.001);
      expect(
        Math.abs(afterBoundary.immersionOpacity - beforeBoundary.immersionOpacity),
      ).toBeLessThan(0.001);
    }
  });

  it('construit un seul volume procédural tridimensionnel', () => {
    const volume = new MilkyWayVolume();
    const proceduralVolume = volume.root.getObjectByName('milky-way-procedural-density-volume');

    expect(volume.atlasStatus).toBe('procedural');
    expect(volume.root.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      rasterAtlas: 'none',
      depthTechnique: 'procedural-ray-marched-density-volume',
      apparentScaleTreatment: 'illustrative-immersive-envelope-over-canonical-reference-frame',
      physicalDiameterLightYears: 100_000,
      authoringDiameter: 11_400,
      transitionRepresentation: 'continuous-three-dimensional-density-and-stellar-volume',
    });
    expect(proceduralVolume).toBeInstanceOf(THREE.Mesh);
    expect(volume.root.children).toHaveLength(1);
    expect(volume.visibleDiscLayerCount).toBe(0);
    expect(volume.drawMeshCount).toBe(0);

    volume.dispose();
  });

  it('amortit, adapte la qualité et masque la représentation hors des niveaux actifs', () => {
    const volume = new MilkyWayVolume();
    const proceduralVolume = volume.root.getObjectByName(
      'milky-way-procedural-density-volume',
    ) as THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
    const volumeGeometryDispose = vi.spyOn(proceduralVolume.geometry, 'dispose');

    volume.setQuality('high');
    expect(proceduralVolume.userData['rayMarchSteps']).toBe(32);

    volume.update(17_000, 0);
    expect(volume.root.visible).toBe(false);

    volume.update(17_000, 1 / 60);
    const partialOpacity = proceduralVolume.material.uniforms['volumeOpacity']!.value as number;

    expect(partialOpacity).toBeGreaterThan(0);
    expect(partialOpacity).toBeLessThan(0.92 * 0.46);

    volume.update(17_000, 10);
    const localGroupScale = calculateMilkyWaySceneScale(17_000);

    expect(volume.root.visible).toBe(true);
    expect(volume.root.scale.x).toBeCloseTo(localGroupScale.modelScale, 8);
    expect(volume.root.userData).toMatchObject({
      worldDiameter: localGroupScale.worldDiameter,
      physicalWorldDiameter: localGroupScale.physicalWorldDiameter,
      visualScaleFactor: localGroupScale.visualScaleFactor,
      visualSceneUnitsPerKiloparsec: localGroupScale.visualSceneUnitsPerKiloparsec,
      referenceFrameSceneUnitsPerKiloparsec: localGroupScale.referenceFrameSceneUnitsPerKiloparsec,
      referenceFrameBlend: 'intergalactic-to-galactic',
    });
    expect(volume.proceduralVolumeVisible).toBe(true);
    expect(volume.drawMeshCount).toBe(1);
    expect(volume.root.userData['atlasOpacity']).toBe(0);

    volume.update(17_000, 10, 1, false);
    expect(volume.root.visible).toBe(false);
    expect(volume.drawMeshCount).toBe(0);

    volume.update(1_400, 10);
    expect(volume.root.visible).toBe(true);
    expect(volume.proceduralVolumeVisible).toBe(true);
    expect(volume.drawMeshCount).toBe(1);

    volume.update(2.7, 10);
    expect(volume.root.visible).toBe(true);
    expect(proceduralVolume.material.uniforms['volumeOpacity']!.value).toBeCloseTo(0.0736, 6);

    volume.update(2.7, 10, 1, false);
    expect(volume.root.visible).toBe(false);

    volume.dispose();
    volume.dispose();
    expect(volumeGeometryDispose).toHaveBeenCalledOnce();
    expect(volume.root.children).toHaveLength(0);
  });
});
