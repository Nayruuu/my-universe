import * as THREE from 'three';
import { SpaceObject } from '../../data/models/universe.models';
import {
  BlackHoleLensingPass,
  calculateFullColorLensingColor,
  calculateThinLensSourceRadius,
  dampLensingStrength,
  projectBlackHoleLensing,
  type BlackHoleLensingEffect,
} from './black-hole-lensing-pass';

describe('lentille gravitationnelle locale des trous noirs', () => {
  it('projette une zone illustrative centrée avec un rayon d’Einstein lié à la qualité', () => {
    const camera = cameraLookingForward();
    const effect = projectBlackHoleLensing(
      blackHole('active'),
      new THREE.Vector3(0, 0, -20),
      camera,
      1_600,
      1_000,
      'high',
    );

    expect(effect).not.toBeNull();
    expect(effect).toMatchObject({
      objectId: 'test-black-hole',
      centerX: 0.5,
      centerY: 0.5,
      strength: 0.96,
      scientificConfidence: 'illustrative',
    });
    expect(effect!.coreRadius).toBeCloseTo(0.086_602_54, 6);
    expect(effect!.einsteinRadius).toBeCloseTo(0.145_492_27, 6);
    expect(effect!.influenceRadius).toBeCloseTo(0.415_692_19, 6);
    expect(
      projectBlackHoleLensing(
        blackHole('quiescent'),
        new THREE.Vector3(0, 0, -20),
        camera,
        1_600,
        1_000,
        'medium',
      )?.strength,
    ).toBeCloseTo(0.78);
    const dormant = blackHole('dormant');

    delete dormant.visual.blackHoleActivity;
    expect(
      projectBlackHoleLensing(dormant, new THREE.Vector3(0, 0, -20), camera, 1_600, 1_000, 'medium')
        ?.strength,
    ).toBeCloseTo(0.78);
  });

  it('ignore les objets, qualités et projections qui ne peuvent pas produire l’effet', () => {
    const camera = cameraLookingForward();
    const hole = blackHole('quiescent');
    const star = { ...hole, type: 'star' } as SpaceObject;

    expect(projectBlackHoleLensing(undefined, null, camera, 800, 600, 'high')).toBeNull();
    expect(
      projectBlackHoleLensing(star, new THREE.Vector3(0, 0, -10), camera, 800, 600, 'high'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(0, 0, -10), camera, 800, 600, 'low'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(0, 0, -10), camera, 0, 600, 'high'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(0, 0, -10), camera, 800, 0, 'high'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(0, 0, 10), camera, 800, 600, 'high'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(0, 0, -10_000), camera, 800, 600, 'high'),
    ).toBeNull();
    expect(
      projectBlackHoleLensing(hole, new THREE.Vector3(40, 0, -20), camera, 800, 600, 'high'),
    ).toBeNull();
  });

  it('borne les rayons lorsque le trou noir remplit presque la vue', () => {
    const effect = projectBlackHoleLensing(
      blackHole('active'),
      new THREE.Vector3(0, 0, -2),
      cameraLookingForward(),
      1_000,
      1_000,
      'high',
    );

    expect(effect?.coreRadius).toBe(0.16);
    expect(effect?.influenceRadius).toBe(0.48);
    expect(effect?.einsteinRadius).toBeCloseTo(0.2688);
    expect(effect!.influenceRadius / effect!.coreRadius).toBe(3);
  });

  it('réduit le premier plan adaptatif avant qu’il masque la lentille en zoom rapproché', () => {
    const camera = cameraLookingForward();
    const nearEffect = projectBlackHoleLensing(
      blackHole('active'),
      new THREE.Vector3(0, 0, -2),
      camera,
      1_000,
      1_000,
      'high',
    ) as BlackHoleLensingEffect & { foregroundScale: number };
    const closerEffect = projectBlackHoleLensing(
      blackHole('active'),
      new THREE.Vector3(0, 0, -1),
      camera,
      1_000,
      1_000,
      'high',
    ) as BlackHoleLensingEffect & { foregroundScale: number };

    expect(nearEffect.foregroundScale).toBeCloseTo(0.184_752, 5);
    expect(closerEffect.foregroundScale).toBeCloseTo(0.092_376, 5);
    expect(closerEffect.coreRadius).toBe(nearEffect.coreRadius);
    expect(closerEffect.influenceRadius).toBe(nearEffect.influenceRadius);
  });

  it('amortit l’intensité sans avancer pour un delta nul', () => {
    expect(dampLensingStrength(0.4, 1, 0)).toBe(0.4);
    expect(dampLensingStrength(0, 1, 0.1)).toBeCloseTo(0.698_805_79, 6);
  });

  it('restaure l’inversion et le rayon d’Einstein du modèle mince validé visuellement', () => {
    const coreRadius = 0.16;
    const einsteinRadius = 0.2688;

    expect(calculateThinLensSourceRadius(coreRadius, coreRadius, einsteinRadius)).toBeLessThan(0);
    expect(calculateThinLensSourceRadius(einsteinRadius, coreRadius, einsteinRadius)).toBeCloseTo(
      0,
    );
    expect(calculateThinLensSourceRadius(0.36, coreRadius, einsteinRadius)).toBeCloseTo(
      0.159_296,
      5,
    );
    expect(calculateThinLensSourceRadius(0.44, coreRadius, einsteinRadius)).toBeCloseTo(
      0.275_789,
      5,
    );
  });

  it('remplace toute la couleur de fond par l’image déviée dans la couronne', () => {
    expect(
      calculateFullColorLensingColor([0.125, 0.0625, 0.03125], [0.03125, 0.015625, 0.0078125], 1),
    ).toEqual([0.03125, 0.015625, 0.0078125]);
    expect(calculateFullColorLensingColor([0.125, 0.125, 0.125], [0.75, 0.5, 0.25], 0.5)).toEqual([
      0.4375, 0.3125, 0.1875,
    ]);
    expect(calculateFullColorLensingColor([0.75, 0.75, 0.75], [0.25, 0.5, 0.75], -1)).toEqual([
      0.75, 0.75, 0.75,
    ]);
    expect(calculateFullColorLensingColor([0.25, 0.25, 0.25], [2, -1, 0.5], 2)).toEqual([
      1, 0, 0.5,
    ]);
  });

  it('sépare le fond et le premier plan avant de composer la lentille', () => {
    const pass = new BlackHoleLensingPass();
    const harness = rendererHarness();
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x010208);
    const camera = cameraLookingForward();
    const effect = centeredEffect();
    const foreground = blackHoleForeground();
    const core = foreground.getObjectByName('foreground-core')!;
    const pickTarget = foreground.getObjectByName('foreground-pick-target')!;
    const renderStates: Array<{
      foregroundVisible: boolean;
      foregroundScale: number;
      background: THREE.Scene['background'];
      cameraMask: number;
      coreMask: number;
      pickTargetMask: number;
    }> = [];

    harness.render.mockImplementation((_scene: THREE.Scene, activeCamera: THREE.Camera) => {
      renderStates.push({
        foregroundVisible: foreground.visible,
        foregroundScale: foreground.scale.x,
        background: _scene.background,
        cameraMask: activeCamera.layers.mask,
        coreMask: core.layers.mask,
        pickTargetMask: pickTarget.layers.mask,
      });
    });
    scene.background = background;

    pass.setSize(0, 500, 1, 'high');
    pass.setSize(800, 500, 2, 'high');
    pass.setSize(800, 500, 2, 'high');
    expect(pass.debugState).toMatchObject({ renderWidth: 1_024, renderHeight: 1_000 });

    pass.render(harness.renderer, scene, camera, null, null, 0.1);
    expect(harness.render).toHaveBeenCalledTimes(1);
    expect(harness.render).toHaveBeenLastCalledWith(scene, camera);
    expect(harness.copyFramebufferToTexture).not.toHaveBeenCalled();

    harness.render.mockClear();
    renderStates.length = 0;
    pass.render(harness.renderer, scene, camera, effect, foreground, 1);
    expect(harness.copyFramebufferToTexture).toHaveBeenCalledWith(
      expect.any(THREE.FramebufferTexture),
      expect.any(THREE.Vector2),
    );
    expect(harness.render).toHaveBeenCalledTimes(3);
    expect(harness.render).toHaveBeenNthCalledWith(1, scene, camera);
    expect(harness.render.mock.calls[1]?.[0]).not.toBe(scene);
    expect(harness.render).toHaveBeenNthCalledWith(3, scene, camera);
    expect(renderStates).toEqual([
      {
        foregroundVisible: false,
        foregroundScale: 1,
        background,
        cameraMask: 1,
        coreMask: 1,
        pickTargetMask: 2,
      },
      {
        foregroundVisible: false,
        foregroundScale: 1,
        background: null,
        cameraMask: 1,
        coreMask: 1,
        pickTargetMask: 2,
      },
      {
        foregroundVisible: true,
        foregroundScale: 0.5,
        background: null,
        cameraMask: 4,
        coreMask: 4,
        pickTargetMask: 2,
      },
    ]);
    expect(foreground.visible).toBe(true);
    expect(foreground.scale.toArray()).toEqual([1, 1, 1]);
    expect(camera.layers.mask).toBe(1);
    expect(core.layers.mask).toBe(1);
    expect(pickTarget.layers.mask).toBe(2);
    expect(scene.background).toBe(background);
    expect(pass.debugState).toMatchObject({
      active: true,
      objectId: 'test-black-hole',
      distortionModel: 'thin-lens-einstein-ring',
      compositionMode: 'background-lens-foreground',
      backgroundPreservation: 'live-framebuffer-thin-lens',
      foregroundSeparated: true,
      scientificConfidence: 'illustrative',
      renderWidth: 1_024,
      renderHeight: 1_000,
    });
    expect(pass.debugState.strength).toBeCloseTo(0.96, 4);
    expect(pass.debugState.einsteinRadius).toBeCloseTo(0.14);
    expect(harness.reset).not.toHaveBeenCalled();
    expect(harness.info.autoReset).toBe(true);
    expect(harness.renderer.autoClear).toBe(true);
    pass.dispose();
  });

  it('garde une composition bornée lorsque le premier plan est déjà masqué', () => {
    const pass = new BlackHoleLensingPass();
    const harness = rendererHarness();
    const foreground = blackHoleForeground();

    foreground.visible = false;
    pass.setSize(800, 600, 1, 'medium');
    pass.render(
      harness.renderer,
      new THREE.Scene(),
      cameraLookingForward(),
      centeredEffect(),
      foreground,
      1,
    );

    expect(harness.render).toHaveBeenCalledTimes(2);
    expect(pass.debugState.foregroundSeparated).toBe(false);
    expect(foreground.visible).toBe(false);
    pass.dispose();
  });

  it('conserve les rayons écran sur un framebuffer HiDPI borné', () => {
    const pass = new BlackHoleLensingPass();
    const harness = rendererHarness();
    const effect: BlackHoleLensingEffect = {
      ...centeredEffect(),
      coreRadius: 0.16,
      einsteinRadius: 0.2688,
      influenceRadius: 0.48,
      foregroundScale: 0.1,
    };
    const foreground = blackHoleForeground();
    const renderedScales: number[] = [];

    harness.render.mockImplementation(() => {
      if (foreground.visible) {
        renderedScales.push(foreground.scale.x);
      }
    });
    pass.setSize(1_600, 1_000, 2, 'high');
    pass.render(harness.renderer, new THREE.Scene(), cameraLookingForward(), effect, foreground, 1);

    expect(pass.debugState).toMatchObject({
      displayCoreRadius: 0.16,
      displayInfluenceRadius: 0.48,
      renderWidth: 1_024,
      renderHeight: 1_024,
    });
    expect(pass.debugState.displayInfluenceRadius / pass.debugState.displayCoreRadius).toBe(3);
    expect(renderedScales.at(-1)).toBeCloseTo(0.1);
    expect(foreground.scale.toArray()).toEqual([1, 1, 1]);
    pass.dispose();
  });

  it('fait disparaître progressivement la passe et respecte des métriques déjà cumulées', () => {
    const pass = new BlackHoleLensingPass();
    const harness = rendererHarness(false);
    const scene = new THREE.Scene();
    const camera = cameraLookingForward();

    pass.setSize(900, 600, 1, 'medium');
    expect(pass.debugState).toMatchObject({ renderWidth: 768, renderHeight: 600 });
    const foreground = blackHoleForeground();

    pass.render(harness.renderer, scene, camera, centeredEffect(), foreground, 1);
    pass.render(harness.renderer, scene, camera, null, null, 0);
    expect(pass.debugState.active).toBe(true);

    harness.render.mockClear();
    harness.copyFramebufferToTexture.mockClear();
    pass.render(harness.renderer, scene, camera, null, null, 1);
    expect(pass.debugState).toMatchObject({
      active: false,
      objectId: null,
      scientificConfidence: null,
    });
    expect(harness.render).toHaveBeenCalledOnce();
    expect(harness.copyFramebufferToTexture).not.toHaveBeenCalled();
    expect(harness.reset).not.toHaveBeenCalled();
    expect(harness.info.autoReset).toBe(false);

    pass.dispose();
  });
});

function cameraLookingForward(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100_000);

  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return camera;
}

function blackHole(activity: 'dormant' | 'quiescent' | 'active'): SpaceObject {
  return {
    id: 'test-black-hole',
    name: 'Trou noir de test',
    type: 'black-hole',
    parentId: 'milky-way',
    referenceFrame: 'galactic',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 2,
      scaleMode: 'adaptive',
      blackHoleActivity: activity,
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'kiloparsec',
    },
  };
}

function centeredEffect(): BlackHoleLensingEffect {
  return {
    objectId: 'test-black-hole',
    centerX: 0.5,
    centerY: 0.5,
    coreRadius: 0.08,
    einsteinRadius: 0.14,
    influenceRadius: 0.34,
    foregroundScale: 0.5,
    strength: 0.96,
    scientificConfidence: 'illustrative',
  };
}

function blackHoleForeground(): THREE.Group {
  const root = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 3), new THREE.MeshBasicMaterial());
  const pickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(1, 4, 3),
    new THREE.MeshBasicMaterial(),
  );

  core.name = 'foreground-core';
  pickTarget.name = 'foreground-pick-target';
  pickTarget.layers.set(1);
  root.add(core, pickTarget);

  return root;
}

function rendererHarness(autoReset = true): {
  renderer: THREE.WebGLRenderer;
  render: ReturnType<typeof vi.fn>;
  copyFramebufferToTexture: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  info: { autoReset: boolean; reset: ReturnType<typeof vi.fn> };
} {
  const render = vi.fn();
  const copyFramebufferToTexture = vi.fn();
  const reset = vi.fn();
  const info = { autoReset, reset };
  const renderer = {
    render,
    copyFramebufferToTexture,
    info,
    autoClear: true,
  } as unknown as THREE.WebGLRenderer;

  return { renderer, render, copyFramebufferToTexture, reset, info };
}
