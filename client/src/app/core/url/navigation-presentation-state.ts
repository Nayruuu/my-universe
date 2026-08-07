import { inject, Injectable, signal, type WritableSignal } from '@angular/core';
import type { NavigationViewMode } from '../../../data/models/universe.models';
import { NavigationUrlService } from './navigation-url.service';

@Injectable({ providedIn: 'root' })
export class NavigationPresentationState {
  public readonly viewMode: WritableSignal<NavigationViewMode>;
  public readonly observerLocationId: WritableSignal<string | null>;

  private readonly urlService = inject(NavigationUrlService);

  constructor() {
    const initialNavigation = this.urlService.read();

    this.viewMode = signal(initialNavigation.view ?? 'map');
    this.observerLocationId = signal(initialNavigation.observerLocationId ?? null);
  }

  public setViewMode(view: NavigationViewMode): void {
    this.viewMode.set(view);
    this.write();
  }

  public setObserverLocationId(observerLocationId: string | null): void {
    this.observerLocationId.set(observerLocationId);
    this.write();
  }

  private write(): void {
    this.urlService.updateViewContext(this.viewMode(), this.observerLocationId());
  }
}
