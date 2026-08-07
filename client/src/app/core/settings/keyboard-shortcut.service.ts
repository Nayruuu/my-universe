import { inject, Injectable } from '@angular/core';
import { EarthSkyViewState } from '../../features/stellar-observation/earth-sky-view-state';
import { UniverseEngineFacade } from '../engine/universe-engine.facade';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService {
  private started = false;
  private readonly facade = inject(UniverseEngineFacade);
  private readonly earthSkyViewState = inject(EarthSkyViewState);

  public start(): void {
    if (this.started) {
      return;
    }
    window.addEventListener('keydown', this.handleKeydown);
    this.started = true;
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    window.removeEventListener('keydown', this.handleKeydown);
    this.started = false;
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        this.facade.togglePlaying();
        break;
      case 'f':
        this.focusSelected();
        break;
      case 'escape':
        this.facade.closeDetails();
        break;
      case '+':
      case '=':
        this.facade.cycleSpeed(1);
        break;
      case '-':
        this.facade.cycleSpeed(-1);
        break;
    }
  };

  private focusSelected(): void {
    if (!this.facade.selectedId()) {
      return;
    }
    if (this.earthSkyViewState.phase() !== 'closed') {
      this.earthSkyViewState.close();
      this.facade.setTemporalMode('state');
    }
    this.facade.focusSelected();
  }
}
