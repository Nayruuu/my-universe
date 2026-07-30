import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  getNavigationScaleForLod,
  NAVIGATION_SCALES,
  type NavigationScaleDefinition,
} from '../../../engine/camera/navigation-scales';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';

@Component({
  selector: 'app-scale-navigator',
  styleUrl: './scale-navigator.component.scss',
  templateUrl: './scale-navigator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleNavigatorComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly menuOpen = signal(false);
  protected readonly navigationScales = NAVIGATION_SCALES;

  protected scaleLabel(): string {
    const lodLevel = this.facade.lodLevel();
    const defaultLabel = getNavigationScaleForLod(lodLevel).label;
    const target = this.facade.objects().find((object) => object.id === this.facade.targetId());

    if (target?.type === 'black-hole') {
      return 'Trou noir';
    }

    if (lodLevel !== 3) {
      return defaultLabel;
    }

    return target?.type === 'galaxy' ? target.name : defaultLabel;
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected viewScale(scale: NavigationScaleDefinition): void {
    this.menuOpen.set(false);
    this.facade.viewScale(scale);
  }
}
