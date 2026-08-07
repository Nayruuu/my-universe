import * as THREE from 'three';
import { type SpaceObject } from '../../data/models/universe.models';
import { type BlackHoleLensingEffect } from '../rendering/black-hole-lensing-pass';
import {
  type BlackHoleLensingProjector,
  type UniverseFrameRendererBindings,
  type UniverseFrameRenderingServices,
  UniverseFrameRenderer,
} from './universe-frame-renderer';

describe('UniverseFrameRenderer', () => {
  it('privilégie la cible pour la lentille et la sélection pour les labels', () => {
    const harness = createHarness();
    const effect = lensingEffect('gaia-bh1');

    harness.projectLensing.mockReturnValue(effect);
    harness.renderer.render(0.1, harness.services, 3);

    expect(harness.getDefinition).toHaveBeenCalledWith('gaia-bh1');
    expect(harness.getWorldPosition).toHaveBeenCalledWith('gaia-bh1', expect.any(THREE.Vector3));
    expect(harness.projectLensing).toHaveBeenCalledWith(
      harness.blackHole,
      harness.worldPosition,
      harness.camera,
      1_280,
      720,
      'high',
    );
    expect(harness.getRegistry).toHaveBeenCalledWith('gaia-bh1');
    expect(harness.registry.getLensingForeground).toHaveBeenCalledWith('gaia-bh1');
    expect(harness.lensingPass.render).toHaveBeenCalledWith(
      harness.webGlRenderer,
      harness.scene,
      harness.camera,
      effect,
      harness.foreground,
      0.1,
    );
    expect(harness.renderLabels).toHaveBeenCalledWith(
      harness.camera,
      expect.any(Function),
      3,
      'earth',
    );

    const readWorldPosition = harness.renderLabels.mock.calls[0]?.[1] as (
      objectId: string,
      target: THREE.Vector3,
    ) => THREE.Vector3 | null;
    const labelTarget = new THREE.Vector3();

    expect(readWorldPosition('earth', labelTarget)).toBe(harness.worldPosition);
    expect(harness.getWorldPosition).toHaveBeenLastCalledWith('earth', labelTarget);
    expect(harness.clearLabels).not.toHaveBeenCalled();
  });

  it('utilise la sélection en repli et accepte un registre absent', () => {
    const harness = createHarness({ targetId: null, registryAvailable: false });

    harness.renderer.render(0.25, harness.services, 2);

    expect(harness.getDefinition).toHaveBeenCalledWith('earth');
    expect(harness.getRegistry).toHaveBeenCalledWith('earth');
    expect(harness.lensingPass.render).toHaveBeenCalledWith(
      harness.webGlRenderer,
      harness.scene,
      harness.camera,
      null,
      null,
      0.25,
    );
    expect(harness.renderLabels).toHaveBeenCalledWith(
      harness.camera,
      expect.any(Function),
      2,
      'earth',
    );
  });

  it('rend sans candidat de lentille et masque les labels interdits', () => {
    const harness = createHarness({ targetId: null, selectedId: null, labelsAllowed: false });

    harness.renderer.render(0.5, harness.services, 6);

    expect(harness.getDefinition).not.toHaveBeenCalled();
    expect(harness.getWorldPosition).not.toHaveBeenCalled();
    expect(harness.getRegistry).not.toHaveBeenCalled();
    expect(harness.projectLensing).toHaveBeenCalledWith(
      undefined,
      null,
      harness.camera,
      1_280,
      720,
      'high',
    );
    expect(harness.lensingPass.render).toHaveBeenCalledWith(
      harness.webGlRenderer,
      harness.scene,
      harness.camera,
      null,
      null,
      0.5,
    );
    expect(harness.renderLabels).not.toHaveBeenCalled();
    expect(harness.clearLabels).toHaveBeenCalledOnce();
  });
});

interface HarnessOptions {
  readonly targetId: string | null;
  readonly selectedId: string | null;
  readonly labelsAllowed: boolean;
  readonly registryAvailable: boolean;
}

function createHarness(overrides: Partial<HarnessOptions> = {}) {
  const options: HarnessOptions = {
    targetId: 'gaia-bh1',
    selectedId: 'earth',
    labelsAllowed: true,
    registryAvailable: true,
    ...overrides,
  };
  const blackHole = object('gaia-bh1', 'black-hole');
  const earth = object('earth', 'planet');
  const worldPosition = new THREE.Vector3(0, 0, -20);
  const foreground = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 1_000);
  const scene = new THREE.Scene();
  const webGlRenderer = {} as THREE.WebGLRenderer;
  const registry = {
    getLensingForeground: vi.fn(() => foreground),
  };
  const lensingPass = {
    render: vi.fn(),
  };
  const services: UniverseFrameRenderingServices = {
    renderer: webGlRenderer,
    camera,
    scene,
    lensingPass,
    viewportWidth: 1_280,
    viewportHeight: 720,
  };
  const getDefinition = vi.fn((objectId: string) =>
    objectId === blackHole.id ? blackHole : objectId === earth.id ? earth : undefined,
  );
  const getWorldPosition = vi.fn(() => worldPosition);
  const getRegistry = vi.fn(() => (options.registryAvailable ? registry : null));
  const renderLabels = vi.fn();
  const clearLabels = vi.fn();
  const projectLensing = vi.fn<BlackHoleLensingProjector>(() => null);
  const bindings: UniverseFrameRendererBindings = {
    getTargetId: () => options.targetId,
    getSelectedId: () => options.selectedId,
    getQuality: () => 'high',
    labelsAllowed: () => options.labelsAllowed,
    getDefinition,
    getWorldPosition,
    getRegistry,
    renderLabels,
    clearLabels,
  };

  return {
    renderer: new UniverseFrameRenderer(bindings, projectLensing),
    services,
    blackHole,
    worldPosition,
    foreground,
    camera,
    scene,
    webGlRenderer,
    registry,
    lensingPass,
    getDefinition,
    getWorldPosition,
    getRegistry,
    renderLabels,
    clearLabels,
    projectLensing,
  };
}

function object(id: string, type: SpaceObject['type']): SpaceObject {
  return {
    id,
    name: id,
    type,
    referenceFrame: 'galactic',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: 2,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'light-year',
    },
  };
}

function lensingEffect(objectId: string): BlackHoleLensingEffect {
  return {
    objectId,
    centerX: 0.5,
    centerY: 0.5,
    coreRadius: 0.04,
    einsteinRadius: 0.06,
    influenceRadius: 0.2,
    foregroundScale: 1,
    strength: 0.96,
    scientificConfidence: 'illustrative',
  };
}
