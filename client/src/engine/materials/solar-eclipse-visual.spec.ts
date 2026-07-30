import * as THREE from 'three';
import { SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { SolarEclipseVisual } from './solar-eclipse-visual';

describe('rendu des éclipses solaires', () => {
  it('active l’ombre et le corridor selon la phase et le LOD', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 6);
    const visual = new SolarEclipseVisual(geometry, 0.62);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('total'));
    visual.setPath([new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)], 'total');

    expect(visual.mesh.visible).toBe(true);
    expect(visual.path.visible).toBe(true);
    expect(visual.mesh.userData['eclipsePhase']).toBe('total');
    expect(visual.mesh.material.vertexShader).toContain('logdepthbuf_vertex');
    expect(visual.mesh.material.fragmentShader).toContain('logdepthbuf_fragment');
    expect(visual.mesh.material.polygonOffset).toBe(true);
    expect(visual.mesh.material.uniforms['moonPosition']?.value).toEqual(
      new THREE.Vector3(60, 0.4, 0),
    );
    expect(visual.mesh.material.uniforms['shadowCenter']?.value).toEqual(
      new THREE.Vector3(1, 0, 0),
    );
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(1);
    expect(visual.mesh.userData['visualScaleMode']).toBe('adaptive');
    expect(visual.mesh.userData['eclipsePalette']).toBe('penumbra-cyan-totality-coral');
    expect(visual.mesh.material.fragmentShader).toContain('displayRing');
    expect(visual.mesh.material.fragmentShader).toContain('penumbraColor');
    expect(visual.mesh.material.fragmentShader).toContain('totalityColor');

    visual.updateAppearance(appearance('annular'));
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(0.72);
    visual.setPath([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], 'annular');
    expect(visual.path.userData['eclipseKind']).toBe('annular');
    visual.updateAppearance(appearance('partial'));
    expect(visual.mesh.material.uniforms['centralShadow']?.value).toBe(0);

    visual.setVisibilityBlend(0);
    expect(visual.mesh.visible).toBe(false);
    expect(visual.path.visible).toBe(false);

    visual.setVisibilityBlend(1);
    visual.updateAppearance(appearance('none'));
    visual.clearPath();
    expect(visual.mesh.visible).toBe(false);
    expect(visual.path.visible).toBe(false);

    visual.mesh.material.dispose();
    visual.path.geometry.dispose();
    visual.path.material.dispose();
    geometry.dispose();
  });
});

function appearance(phase: SolarEclipseAppearance['phase']): SolarEclipseAppearance {
  return {
    phase,
    sunPositionInEarthRadii: { x: 23_400, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 60, y: 0.4, z: 0 },
    shadowDirection: { x: 1, y: 0, z: 0 },
    centralLatitude: 65.2,
    centralLongitude: -25.2,
  };
}
