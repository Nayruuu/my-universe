import { UniverseRuntimeDisposer } from './universe-runtime-disposer';

describe('UniverseRuntimeDisposer', () => {
  it('libère toutes les ressources dans un ordre déterministe', () => {
    const calls: string[] = [];
    const disposable = (name: string) => ({
      dispose: vi.fn(() => calls.push(name)),
    });
    const renderer = {
      renderLists: {
        dispose: vi.fn(() => calls.push('render-lists')),
      },
      dispose: vi.fn(() => calls.push('renderer')),
      domElement: {
        remove: vi.fn(() => calls.push('canvas')),
      },
    };
    const resources = [
      disposable('streaming'),
      disposable('selection'),
      disposable('camera'),
      disposable('labels'),
      disposable('objects'),
      disposable('scene'),
      disposable('lensing'),
    ] as const;

    new UniverseRuntimeDisposer().dispose(resources, renderer);

    expect(calls).toEqual([
      'streaming',
      'selection',
      'camera',
      'labels',
      'objects',
      'scene',
      'lensing',
      'render-lists',
      'renderer',
      'canvas',
    ]);
  });

  it('tolère un moteur partiellement initialisé', () => {
    const objectRuntime = { dispose: vi.fn() };

    new UniverseRuntimeDisposer().dispose(
      [null, null, null, null, objectRuntime, null, null],
      null,
    );

    expect(objectRuntime.dispose).toHaveBeenCalledOnce();
  });
});
