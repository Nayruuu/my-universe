import {
  UniverseEngineInitializationCancelledError,
  UniverseEngineLifecycle,
} from './universe-engine-lifecycle';

describe('UniverseEngineLifecycle', () => {
  it('partage une initialisation concurrente puis court-circuite une instance prête', async () => {
    const lifecycle = new UniverseEngineLifecycle();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const initialize = vi.fn(async (revision: number) => {
      await gate;
      lifecycle.ensureCurrent(revision);
      lifecycle.restoreInitialized(true);
    });

    const first = lifecycle.initialize(initialize);
    const concurrent = lifecycle.initialize(initialize);

    expect(concurrent).toBe(first);
    expect(initialize).toHaveBeenCalledOnce();
    release();
    await first;
    expect(lifecycle.initialized).toBe(true);

    await lifecycle.initialize(initialize);
    expect(initialize).toHaveBeenCalledOnce();
  });

  it('invalide un résultat tardif et accepte immédiatement une nouvelle génération', async () => {
    const lifecycle = new UniverseEngineLifecycle();
    const releaseResources = vi.fn();
    let releaseStale!: () => void;
    const staleGate = new Promise<void>((resolve) => (releaseStale = resolve));
    let staleRevision = -1;
    const stale = lifecycle.initialize(async (revision) => {
      staleRevision = revision;
      await staleGate;
      lifecycle.ensureCurrent(revision);
    });

    lifecycle.dispose(releaseResources);
    expect(releaseResources).toHaveBeenCalledOnce();
    expect(lifecycle.initialized).toBe(false);
    expect(lifecycle.isCurrent(staleRevision)).toBe(false);

    await lifecycle.initialize(async (revision) => {
      expect(revision).toBeGreaterThan(staleRevision);
      lifecycle.ensureCurrent(revision);
      lifecycle.restoreInitialized(true);
    });
    expect(lifecycle.initialized).toBe(true);

    releaseStale();
    await expect(stale).rejects.toBeInstanceOf(UniverseEngineInitializationCancelledError);
    expect(lifecycle.initialized).toBe(true);
  });

  it('protège le démarrage tant que le moteur n’est pas prêt', () => {
    const lifecycle = new UniverseEngineLifecycle();

    expect(() => lifecycle.requireInitialized()).toThrow('doit être initialisé');
    lifecycle.restoreInitialized(true);
    expect(() => lifecycle.requireInitialized()).not.toThrow();
  });
});
