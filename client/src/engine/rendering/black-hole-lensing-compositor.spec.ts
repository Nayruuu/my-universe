import * as THREE from 'three';
import {
  BlackHoleLensingCompositor,
  type BlackHoleLensingComposition,
} from './black-hole-lensing-compositor';

describe('compositeur GPU de la lentille des trous noirs', () => {
  it('dimensionne la capture HiDPI et compose uniquement la région influencée', () => {
    const compositor = new BlackHoleLensingCompositor();
    const harness = rendererHarness();

    compositor.setSize(800, 500, 2, 'high');
    const display = compositor.renderOverlay(harness.renderer, centeredComposition());

    expect(display).toMatchObject({
      coreRadius: 0.08,
      influenceRadius: 0.34,
      foregroundScale: 0.5,
      renderWidth: 1_024,
      renderHeight: 1_000,
    });
    expect(harness.copyFramebufferToTexture).toHaveBeenCalledWith(
      expect.any(THREE.FramebufferTexture),
      expect.any(THREE.Vector2),
    );
    expect(harness.render).toHaveBeenCalledOnce();
    expect(harness.renderer.autoClear).toBe(true);
    expect(harness.info.autoReset).toBe(true);

    const internals = compositor as unknown as {
      readonly framebufferTexture: THREE.FramebufferTexture;
      readonly geometry: THREE.PlaneGeometry;
      readonly material: THREE.ShaderMaterial;
      readonly mesh: THREE.Mesh;
    };
    const textureDispose = vi.spyOn(internals.framebufferTexture, 'dispose');
    const geometryDispose = vi.spyOn(internals.geometry, 'dispose');
    const materialDispose = vi.spyOn(internals.material, 'dispose');

    expect(internals.material.blending).toBe(THREE.NormalBlending);
    expect(internals.material.uniforms['environmentTexture']).toBeUndefined();
    expect(internals.mesh.userData).toMatchObject({
      scientificConfidence: 'illustrative',
      distortionModel: 'thin-lens-einstein-ring',
    });
    compositor.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('restaure la scène, la caméra et le premier plan après sa passe dédiée', () => {
    const compositor = new BlackHoleLensingCompositor();
    const harness = rendererHarness(false);
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x010208);
    const camera = new THREE.PerspectiveCamera();
    const foreground = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial());

    scene.background = background;
    foreground.add(core);
    compositor.renderForeground(harness.renderer, scene, camera, foreground, 0.4);

    expect(harness.render).toHaveBeenCalledWith(scene, camera);
    expect(foreground.scale.toArray()).toEqual([1, 1, 1]);
    expect(core.layers.mask).toBe(1);
    expect(camera.layers.mask).toBe(1);
    expect(scene.background).toBe(background);
    expect(harness.renderer.autoClear).toBe(true);
    expect(harness.info.autoReset).toBe(false);
    compositor.dispose();
  });
});

function centeredComposition(): BlackHoleLensingComposition {
  return {
    centerX: 0.5,
    centerY: 0.5,
    coreRadius: 0.08,
    einsteinRadius: 0.14,
    influenceRadius: 0.34,
    foregroundScale: 0.5,
    strength: 0.96,
  };
}

function rendererHarness(autoReset = true): {
  renderer: THREE.WebGLRenderer;
  render: ReturnType<typeof vi.fn>;
  copyFramebufferToTexture: ReturnType<typeof vi.fn>;
  info: { autoReset: boolean };
} {
  const render = vi.fn();
  const copyFramebufferToTexture = vi.fn();
  const info = { autoReset };
  const renderer = {
    render,
    copyFramebufferToTexture,
    info,
    autoClear: true,
  } as unknown as THREE.WebGLRenderer;

  return { renderer, render, copyFramebufferToTexture, info };
}
