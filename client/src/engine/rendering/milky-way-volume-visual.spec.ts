import * as THREE from 'three';
import { calculateMilkyWaySceneScale } from '../coordinates/galaxy-scale-model';
import { MilkyWayVolumeVisual } from './milky-way-volume-visual';

describe('MilkyWayVolumeVisual', () => {
  it('conserve une seule représentation procédurale sans atlas raster', () => {
    const visual = new MilkyWayVolumeVisual();
    const proceduralVolume = visual.root.getObjectByName(
      'milky-way-procedural-density-volume',
    ) as THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
    const volumeGeometryDispose = vi.spyOn(proceduralVolume.geometry, 'dispose');

    expect(visual.root.userData).toMatchObject({
      rasterAtlas: 'none',
      scientificConfidence: 'illustrative',
      morphologyModel: 'barred-spiral-with-two-major-and-two-minor-arms',
      apparentScaleTreatment: 'illustrative-immersive-envelope-over-canonical-reference-frame',
      physicalDiameterLightYears: 100_000,
      authoringDiameter: 11_400,
      depthTechnique: 'procedural-ray-marched-density-volume',
      proceduralTechnique: 'deterministic-three-dimensional-density-field-with-dust-rifts',
      nearRepresentation: 'fading-density-envelope-with-crisp-batched-stellar-structure',
      transitionRepresentation: 'continuous-three-dimensional-density-and-stellar-volume',
      proceduralVolumeOpacityFactor: 0.46,
      proceduralVolumeThickness: 4_200,
      verticalStructure: 'thin-disc-with-illustrative-luminous-envelope',
      visualThicknessTreatment: 'readable-ray-marched-envelope-around-physical-stellar-containment',
      interiorContinuity: 'restrained-density-floor-through-stellar-neighborhood-navigation',
      interiorClarityTreatment: 'dark-interarm-integrated-light-without-an-interior-handoff-gap',
      integratedLightTreatment:
        'illustrative-unresolved-starlight-clustered-into-arms-filaments-and-clumps',
    });

    visual.setQuality('high');
    const localGroupScale = calculateMilkyWaySceneScale(17_000);

    visual.update(0.8, 0.1, 1.2, localGroupScale);

    expect(visual.visibleDiscLayerCount).toBe(0);
    expect(visual.proceduralVolumeVisible).toBe(true);
    expect(visual.drawMeshCount).toBe(1);
    expect(visual.root.scale.x).toBeCloseTo(localGroupScale.modelScale, 8);
    expect(visual.root.userData).toMatchObject({
      worldDiameter: localGroupScale.worldDiameter,
      physicalWorldDiameter: localGroupScale.physicalWorldDiameter,
      visualScaleFactor: localGroupScale.visualScaleFactor,
      visualSceneUnitsPerKiloparsec: localGroupScale.visualSceneUnitsPerKiloparsec,
      referenceFrameSceneUnitsPerKiloparsec: localGroupScale.referenceFrameSceneUnitsPerKiloparsec,
      referenceFrameBlend: 'intergalactic-to-galactic',
    });
    expect(proceduralVolume.material.uniforms['volumeOpacity']!.value).toBeCloseTo(0.368, 6);
    expect(proceduralVolume.material.uniforms['radiance']!.value).toBe(1.2);
    expect(proceduralVolume.material.fragmentShader).toContain('sampler3D');
    expect(proceduralVolume.material.fragmentShader).toContain('intersectVolumeBox');
    expect(proceduralVolume.material.fragmentShader).toContain('dustAbsorption');
    expect(proceduralVolume.material.fragmentShader).toContain('youngStars');
    expect(proceduralVolume.material.fragmentShader).not.toContain('sampler2D');
    visual.update(0, 0.12, 1, localGroupScale);
    expect(visual.root.visible).toBe(true);
    expect(visual.proceduralVolumeVisible).toBe(true);
    expect(visual.drawMeshCount).toBe(1);
    expect(proceduralVolume.material.uniforms['volumeOpacity']!.value).toBe(0.12);

    visual.dispose();
    expect(volumeGeometryDispose).toHaveBeenCalledOnce();
    expect(visual.root.children).toHaveLength(0);
  });
});
