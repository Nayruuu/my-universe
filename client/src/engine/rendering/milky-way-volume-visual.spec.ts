import * as THREE from 'three';
import {
  getMilkyWayCinematicProfile,
  MILKY_WAY_ATLAS_URL,
  MilkyWayVolumeVisual,
} from './milky-way-volume-visual';

describe('MilkyWayVolumeVisual', () => {
  it('possède seul les couches GPU, le profil photographique et l’atlas', () => {
    const visual = new MilkyWayVolumeVisual();
    const texture = new THREE.Texture(document.createElement('img'));
    const textureDispose = vi.spyOn(texture, 'dispose');
    const base = visual.root.getObjectByName('milky-way-volume-disc-base') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >;

    expect(visual.root.userData).toMatchObject({
      atlasUrl: MILKY_WAY_ATLAS_URL,
      scientificConfidence: 'illustrative',
      morphologyModel: 'barred-spiral-with-two-major-and-two-minor-arms',
    });
    expect(getMilkyWayCinematicProfile('high').parallaxStrength).toBeGreaterThan(
      getMilkyWayCinematicProfile('low').parallaxStrength,
    );

    visual.installAtlas(texture);
    visual.setQuality('high');
    visual.update(0.8, 0.75, 1.2);

    expect(visual.visibleDiscLayerCount).toBe(3);
    expect(visual.drawMeshCount).toBe(4);
    expect(visual.root.scale.toArray()).toEqual([0.75, 0.75, 0.75]);
    expect(base.material.uniforms['opacity']!.value).toBe(0.8);
    expect(base.material.uniforms['galaxyRadiance']!.value).toBe(1.2);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.anisotropy).toBe(4);

    visual.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(visual.root.children).toHaveLength(0);
  });
});
