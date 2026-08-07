import { UniverseDeferredCatalogCoordinator } from './universe-deferred-catalog-coordinator';

describe('UniverseDeferredCatalogCoordinator', () => {
  it('planifie un chargement unique après la première vue puis publie les données', async () => {
    const harness = createHarness();

    harness.coordinator.schedule();
    harness.coordinator.schedule();
    expect(harness.schedule).toHaveBeenCalledOnce();
    expect(harness.installDeferredCatalogs).not.toHaveBeenCalled();

    await harness.runScheduled();

    expect(harness.installDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.refreshCatalogs).toHaveBeenCalledOnce();
    expect(harness.emitWarning).toHaveBeenCalledWith('catalogue partiel');
  });

  it('attend le catalogue immédiatement pour une cible absente et mutualise les appels', async () => {
    const harness = createHarness({ initiallyAvailable: false });
    const first = harness.coordinator.ensureObjectAvailable('kepler-22-b');
    const second = harness.coordinator.ensureObjectAvailable('kepler-22-b');

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(harness.installDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.refreshCatalogs).toHaveBeenCalledOnce();
  });

  it('attend aussi les couches requises par une cible déjà connue', async () => {
    const harness = createHarness({ requiredTarget: 'local-group' });

    await expect(harness.coordinator.ensureObjectAvailable('local-group')).resolves.toBe(true);

    expect(harness.installDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.refreshCatalogs).toHaveBeenCalledOnce();
  });

  it('considère une cible connue comme prête lorsque ses catalogues sont déjà installés', async () => {
    const harness = createHarness({
      hasDeferredCatalogs: false,
      requiredTarget: 'local-group',
    });

    await expect(harness.coordinator.ensureObjectAvailable('local-group')).resolves.toBe(true);

    expect(harness.installDeferredCatalogs).not.toHaveBeenCalled();
  });

  it('ne charge rien pour une cible déjà disponible ou sans catalogue différé', async () => {
    const available = createHarness();

    await expect(available.coordinator.ensureObjectAvailable('earth')).resolves.toBe(true);
    expect(available.installDeferredCatalogs).not.toHaveBeenCalled();

    const complete = createHarness({ hasDeferredCatalogs: false, initiallyAvailable: false });

    complete.coordinator.schedule();
    await expect(complete.coordinator.ensureObjectAvailable('missing')).resolves.toBe(false);
    expect(complete.schedule).not.toHaveBeenCalled();
    expect(complete.installDeferredCatalogs).not.toHaveBeenCalled();
  });

  it('ignore un chargement terminé après une réinitialisation', async () => {
    const harness = createHarness({ initiallyAvailable: false, pending: true });
    const loading = harness.coordinator.ensureObjectAvailable('kepler-22-b');

    harness.coordinator.reset();
    harness.resolveInstallation();

    await expect(loading).resolves.toBe(true);
    expect(harness.refreshCatalogs).not.toHaveBeenCalled();
    expect(harness.emitWarning).not.toHaveBeenCalled();
  });

  it('signale une erreur documentée sans casser la carte et annule une tâche planifiée', async () => {
    const failed = createHarness({ initiallyAvailable: false, failure: new Error('réseau') });

    await expect(failed.coordinator.ensureObjectAvailable('missing')).resolves.toBe(false);
    expect(failed.emitWarning).toHaveBeenCalledWith(
      'Catalogues complémentaires indisponibles : réseau',
    );

    const unknown = createHarness({ initiallyAvailable: false, failure: 'échec brut' });

    await expect(unknown.coordinator.ensureObjectAvailable('missing')).resolves.toBe(false);
    expect(unknown.emitWarning).toHaveBeenCalledWith(
      'Catalogues complémentaires indisponibles : erreur inconnue',
    );

    const staleFailure = createHarness({
      initiallyAvailable: false,
      failure: new Error('trop tard'),
      pendingFailure: true,
    });
    const staleLoading = staleFailure.coordinator.ensureObjectAvailable('missing');

    staleFailure.coordinator.reset();
    staleFailure.rejectInstallation();
    await expect(staleLoading).resolves.toBe(false);
    expect(staleFailure.emitWarning).not.toHaveBeenCalled();

    const cancelled = createHarness();

    cancelled.coordinator.schedule();
    cancelled.coordinator.reset();
    expect(cancelled.cancel).toHaveBeenCalledOnce();
  });
});

interface HarnessOptions {
  readonly initiallyAvailable?: boolean;
  readonly hasDeferredCatalogs?: boolean;
  readonly pending?: boolean;
  readonly pendingFailure?: boolean;
  readonly failure?: unknown;
  readonly requiredTarget?: string;
}

function createHarness(options: HarnessOptions = {}) {
  let available = options.initiallyAvailable ?? true;
  let scheduled: (() => void) | null = null;
  let resolveInstallation = (): void => undefined;
  let rejectInstallation = (): void => undefined;
  const installationGate = options.pending
    ? new Promise<readonly string[]>((resolve) => {
        resolveInstallation = () => {
          available = true;
          resolve(['catalogue partiel']);
        };
      })
    : null;
  const failureGate = options.pendingFailure
    ? new Promise<readonly string[]>((_resolve, reject) => {
        rejectInstallation = () => reject(options.failure);
      })
    : null;
  const installDeferredCatalogs = vi.fn(async () => {
    if (failureGate) {
      return failureGate;
    }
    if (options.failure !== undefined) {
      throw options.failure;
    }
    if (installationGate) {
      return installationGate;
    }
    available = true;

    return ['catalogue partiel'];
  });
  const schedule = vi.fn((callback: () => void) => {
    scheduled = callback;

    return 42;
  });
  const cancel = vi.fn();
  const refreshCatalogs = vi.fn();
  const emitWarning = vi.fn();
  const runtime = {
    hasDeferredCatalogs: options.hasDeferredCatalogs ?? true,
    installDeferredCatalogs,
  };
  const coordinator = new UniverseDeferredCatalogCoordinator({
    getRuntime: () => runtime,
    hasObject: () => available,
    requiresDeferredCatalogs: (objectId) => objectId === options.requiredTarget,
    isRuntimeCurrent: (candidate) => candidate === runtime,
    refreshCatalogs,
    emitWarning,
    schedule,
    cancel,
  });

  return {
    coordinator,
    installDeferredCatalogs,
    refreshCatalogs,
    emitWarning,
    schedule,
    cancel,
    resolveInstallation,
    rejectInstallation,
    runScheduled: async () => {
      scheduled?.();
      await vi.waitFor(() => expect(installDeferredCatalogs).toHaveBeenCalledOnce());
      await Promise.resolve();
    },
  };
}
