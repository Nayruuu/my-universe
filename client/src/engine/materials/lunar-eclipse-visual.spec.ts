import * as THREE from 'three';
import { LunarEclipseAppearance } from '../simulation/earth-eclipse';
import { LunarEclipseVisual } from './lunar-eclipse-visual';

describe('rendu des éclipses lunaires', () => {
  it('active et masque le shader selon la phase et le LOD', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const visual = new LunarEclipseVisual(geometry, 0.2);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('partial'));

    expect(visual.mesh.visible).toBe(true);
    expect(visual.mesh.userData['eclipsePhase']).toBe('partial');
    expect(visual.mesh.material.vertexShader).toContain('logdepthbuf_vertex');
    expect(visual.mesh.material.fragmentShader).toContain('logdepthbuf_fragment');
    expect(visual.mesh.material.polygonOffset).toBe(true);
    expect(visual.mesh.material.uniforms['umbraRadius']?.value).toBe(2.6);

    visual.setVisibilityBlend(0);
    expect(visual.mesh.visible).toBe(false);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('none'));
    expect(visual.mesh.visible).toBe(false);

    visual.mesh.material.dispose();
    geometry.dispose();
  });
});

function appearance(phase: LunarEclipseAppearance['phase']): LunarEclipseAppearance {
  return {
    phase,
    shadowAxis: { x: 1, y: 0, z: 0 },
    shadowOffsetInMoonRadii: { x: 0, y: 1.5, z: 0 },
    umbraRadiusInMoonRadii: 2.6,
    penumbraRadiusInMoonRadii: 5.2,
  };
}
