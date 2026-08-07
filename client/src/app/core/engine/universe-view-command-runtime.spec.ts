import { NAVIGATION_SCALES } from '../../../engine/camera/navigation-scales';
import {
  type UniverseViewCommandRuntimeBindings,
  type UniverseViewCommandRuntimeEngine,
  UniverseViewCommandRuntime,
} from './universe-view-command-runtime';

describe('UniverseViewCommandRuntime', () => {
  it('centre une cible et traduit ses erreurs', async () => {
    const harness = createHarness();

    await harness.runtime.focus('earth');
    expect(harness.resetPresentation).toHaveBeenCalledOnce();
    expect(harness.engine.setTarget).toHaveBeenCalledWith('earth');

    const failure = new Error('introuvable');

    harness.engine.setTarget.mockRejectedValueOnce(failure);
    await harness.runtime.focus('missing');
    expect(harness.describeTargetError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenLastCalledWith('Cible inaccessible');
  });

  it('centre uniquement une sélection existante', async () => {
    const harness = createHarness();

    harness.runtime.focusSelected();
    expect(harness.engine.setTarget).not.toHaveBeenCalled();

    harness.state.selectedId = 'mars';
    harness.runtime.focusSelected();
    await Promise.resolve();
    expect(harness.engine.setTarget).toHaveBeenCalledWith('mars');
  });

  it('cadre la rotation et traduit une erreur', async () => {
    const harness = createHarness();

    await harness.runtime.viewRotation('earth');
    expect(harness.resetPresentation).toHaveBeenCalledOnce();
    expect(harness.engine.viewRotation).toHaveBeenCalledWith('earth');

    const failure = new Error('rotation impossible');

    harness.engine.viewRotation.mockRejectedValueOnce(failure);
    await harness.runtime.viewRotation('moon');
    expect(harness.describeRotationError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenLastCalledWith('Rotation inaccessible');
  });

  it('active les orbites si nécessaire avant de les cadrer', () => {
    const harness = createHarness();

    harness.runtime.viewOrbit('earth');
    expect(harness.showOrbits).toHaveBeenCalledOnce();
    expect(harness.engine.viewOrbit).toHaveBeenCalledWith('earth');

    harness.state.orbitsVisible = true;
    harness.runtime.viewOrbit('mars');
    expect(harness.showOrbits).toHaveBeenCalledOnce();
    expect(harness.engine.viewOrbit).toHaveBeenLastCalledWith('mars');
  });

  it('traduit une orbite inaccessible', () => {
    const harness = createHarness();
    const failure = new Error('orbite impossible');

    harness.engine.viewOrbit.mockImplementationOnce(() => {
      throw failure;
    });
    harness.runtime.viewOrbit('moon');
    expect(harness.describeOrbitError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenLastCalledWith('Orbite inaccessible');
  });

  it('cadre une échelle et traduit une échelle inaccessible', () => {
    const harness = createHarness();
    const scale = NAVIGATION_SCALES[3]!;

    harness.runtime.viewScale(scale);
    expect(harness.engine.viewScale).toHaveBeenCalledWith(scale);

    harness.engine.viewScale.mockImplementationOnce(() => {
      throw new Error('échelle impossible');
    });
    harness.runtime.viewScale(scale);
    expect(harness.getScaleUnavailableMessage).toHaveBeenCalledOnce();
    expect(harness.setError).toHaveBeenLastCalledWith('Échelle inaccessible');
  });

  it('délègue la fermeture, le zoom et le redimensionnement', () => {
    const harness = createHarness();

    harness.runtime.closeDetails();
    harness.runtime.zoomIn();
    harness.runtime.zoomOut();
    harness.runtime.resize(800, 450);

    expect(harness.engine.selectObject).toHaveBeenCalledWith(null);
    expect(harness.engine.zoomBy).toHaveBeenNthCalledWith(1, 0.72);
    expect(harness.engine.zoomBy).toHaveBeenNthCalledWith(2, 1.38);
    expect(harness.engine.resize).toHaveBeenCalledWith(800, 450);
  });
});

function createHarness() {
  const state = {
    selectedId: null as string | null,
    orbitsVisible: false,
  };
  const engine = new FakeViewCommandEngine();
  const resetPresentation = vi.fn();
  const showOrbits = vi.fn(() => {
    state.orbitsVisible = true;
  });
  const setError = vi.fn();
  const describeTargetError = vi.fn(() => 'Cible inaccessible');
  const describeRotationError = vi.fn(() => 'Rotation inaccessible');
  const describeOrbitError = vi.fn(() => 'Orbite inaccessible');
  const getScaleUnavailableMessage = vi.fn(() => 'Échelle inaccessible');
  const bindings: UniverseViewCommandRuntimeBindings = {
    getSelectedId: () => state.selectedId,
    areOrbitsVisible: () => state.orbitsVisible,
    resetPresentation,
    showOrbits,
    setError,
    describeTargetError,
    describeRotationError,
    describeOrbitError,
    getScaleUnavailableMessage,
  };

  return {
    runtime: new UniverseViewCommandRuntime(engine, bindings),
    engine,
    state,
    resetPresentation,
    showOrbits,
    setError,
    describeTargetError,
    describeRotationError,
    describeOrbitError,
    getScaleUnavailableMessage,
  };
}

class FakeViewCommandEngine implements UniverseViewCommandRuntimeEngine {
  public readonly setTarget = vi.fn(async () => undefined);
  public readonly viewRotation = vi.fn(async () => undefined);
  public readonly viewOrbit = vi.fn();
  public readonly viewScale = vi.fn();
  public readonly selectObject = vi.fn();
  public readonly zoomBy = vi.fn();
  public readonly resize = vi.fn();
}
