import { UniverseDeferredCatalogCoordinator } from './universe-deferred-catalog-coordinator';

describe('UniverseDeferredCatalogCoordinator', () => {
  it('planifie un chargement unique après la première vue puis publie les données', async () => {
    const harness = createHarness();

    harness.coordinator.schedule();
    harness.coordinator.schedule();
    expect(harness.prepareDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.schedule).not.toHaveBeenCalled();
    expect(harness.installDeferredCatalogs).not.toHaveBeenCalled();

    await harness.waitForPreparation();
    harness.coordinator.schedule();
    harness.coordinator.schedule();
    expect(harness.schedule).toHaveBeenCalledOnce();
    await harness.runScheduled();

    expect(harness.installDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.refreshCatalogs).toHaveBeenCalledOnce();
    expect(harness.emitWarning).toHaveBeenCalledWith('catalogue partiel');
  });

  it('réinitialise le délai de fond lorsqu’une transition de caméra commence', async () => {
    const harness = createHarness();

    harness.coordinator.schedule();
    await harness.waitForPreparation();
    harness.coordinator.schedule();
    expect(harness.schedule).toHaveBeenCalledOnce();

    harness.setBackgroundBusy(true);
    harness.coordinator.schedule();

    expect(harness.installDeferredCatalogs).not.toHaveBeenCalled();
    expect(harness.cancel).toHaveBeenCalledOnce();
    await harness.runScheduled(false);

    harness.setBackgroundBusy(false);
    harness.coordinator.schedule();
    expect(harness.schedule).toHaveBeenCalledTimes(2);
    await harness.runScheduled();

    expect(harness.installDeferredCatalogs).toHaveBeenCalledOnce();
    expect(harness.refreshCatalogs).toHaveBeenCalledOnce();
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

  it('ignore une préparation terminée après une réinitialisation', async () => {
    const completed = createHarness({ preparationPending: true });

    completed.coordinator.schedule();
    completed.coordinator.reset();
    completed.resolvePreparation();
    await completed.waitForPreparation();

    expect(completed.schedule).not.toHaveBeenCalled();
    expect(completed.refreshCatalogs).not.toHaveBeenCalled();
    expect(completed.emitWarning).not.toHaveBeenCalled();

    const failed = createHarness({
      preparationFailure: new Error('trop tard'),
      preparationPendingFailure: true,
    });

    failed.coordinator.schedule();
    failed.coordinator.reset();
    failed.rejectPreparation();
    await failed.waitForPreparation();

    expect(failed.emitWarning).not.toHaveBeenCalled();
  });

  it('signale une préparation Worker indisponible sans la relancer à chaque image', async () => {
    const failed = createHarness({ preparationFailure: new Error('worker') });

    failed.coordinator.schedule();
    await failed.waitForPreparation();
    failed.coordinator.schedule();

    expect(failed.prepareDeferredCatalogs).toHaveBeenCalledOnce();
    expect(failed.schedule).not.toHaveBeenCalled();
    expect(failed.emitWarning).toHaveBeenCalledWith(
      'Catalogues complémentaires indisponibles : worker',
    );

    const unknown = createHarness({ preparationFailure: 'échec brut' });

    unknown.coordinator.schedule();
    await unknown.waitForPreparation();

    expect(unknown.emitWarning).toHaveBeenCalledWith(
      'Catalogues complémentaires indisponibles : erreur inconnue',
    );
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
    await cancelled.waitForPreparation();
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
  readonly preparationPending?: boolean;
  readonly preparationPendingFailure?: boolean;
  readonly preparationFailure?: unknown;
  readonly requiredTarget?: string;
  readonly backgroundBusy?: boolean;
}

function createHarness(options: HarnessOptions = {}) {
  let available = options.initiallyAvailable ?? true;
  let backgroundBusy = options.backgroundBusy ?? false;
  let scheduled: (() => void) | null = null;
  let resolveInstallation = (): void => undefined;
  let rejectInstallation = (): void => undefined;
  let resolvePreparation = (): void => undefined;
  let rejectPreparation = (): void => undefined;
  const preparationGate = options.preparationPending
    ? new Promise<void>((resolve) => {
        resolvePreparation = resolve;
      })
    : null;
  const preparationFailureGate = options.preparationPendingFailure
    ? new Promise<void>((_resolve, reject) => {
        rejectPreparation = () => reject(options.preparationFailure);
      })
    : null;
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
  const prepareDeferredCatalogs = vi.fn(async () => {
    if (preparationGate) {
      return preparationGate;
    }
    if (preparationFailureGate) {
      return preparationFailureGate;
    }
    if (options.preparationFailure !== undefined) {
      throw options.preparationFailure;
    }
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
    prepareDeferredCatalogs,
    installDeferredCatalogs,
  };
  const coordinator = new UniverseDeferredCatalogCoordinator({
    getRuntime: () => runtime,
    hasObject: () => available,
    requiresDeferredCatalogs: (objectId) => objectId === options.requiredTarget,
    isRuntimeCurrent: (candidate) => candidate === runtime,
    canInstallInBackground: () => !backgroundBusy,
    refreshCatalogs,
    emitWarning,
    schedule,
    cancel,
  });

  return {
    coordinator,
    prepareDeferredCatalogs,
    installDeferredCatalogs,
    refreshCatalogs,
    emitWarning,
    schedule,
    cancel,
    resolveInstallation,
    rejectInstallation,
    resolvePreparation,
    rejectPreparation,
    setBackgroundBusy: (busy: boolean) => {
      backgroundBusy = busy;
    },
    runScheduled: async (expectInstallation = true) => {
      scheduled?.();
      if (expectInstallation) {
        await vi.waitFor(() => expect(installDeferredCatalogs).toHaveBeenCalledOnce());
      }
      await Promise.resolve();
    },
    waitForPreparation: async () => {
      const preparation = prepareDeferredCatalogs.mock.results[0]?.value;

      if (preparation) {
        await Promise.allSettled([preparation]);
      }
      await Promise.resolve();
    },
  };
}
