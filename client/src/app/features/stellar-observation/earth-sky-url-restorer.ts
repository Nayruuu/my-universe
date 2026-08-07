import { effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { NavigationPresentationState } from '../../core/url/navigation-presentation-state';

@Injectable({ providedIn: 'root' })
export class EarthSkyUrlRestorer {
  private readonly facade = inject(UniverseEngineFacade);
  private readonly injector = inject(Injector);
  private readonly navigation = inject(NavigationPresentationState);
  private readonly started = signal(false);
  private restorePending = this.navigation.viewMode() === 'planetarium';

  private readonly restoreWhenReady = effect(() => {
    if (!this.started() || !this.restorePending || !this.facade.ready()) {
      return;
    }
    const targetId = this.facade.targetId();
    const selectedObjectId = this.facade.selectedId();

    this.restorePending = false;
    untracked(() => void this.restore(targetId, selectedObjectId));
  });

  public start(): void {
    this.started.set(true);
  }

  public stop(): void {
    this.started.set(false);
  }

  private async restore(targetId: string | null, selectedObjectId: string | null): Promise<void> {
    const target = targetId ? await this.facade.resolveObject(targetId) : null;
    let restored = false;

    if (target) {
      const [{ equatorialCoordinates }, { EarthSkyJourney }] = await Promise.all([
        import('./earth-sky-catalog'),
        import('./earth-sky-journey'),
      ]);

      restored = equatorialCoordinates(target)
        ? await this.injector.get(EarthSkyJourney).restore(target, selectedObjectId)
        : false;
    }

    if (!restored) {
      this.navigation.setViewMode('map');
      this.facade.setTemporalMode('state');
    }
  }
}
