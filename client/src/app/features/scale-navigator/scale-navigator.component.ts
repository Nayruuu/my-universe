import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  getNavigationScaleForLod,
  NAVIGATION_SCALES,
  type NavigationScaleDefinition,
} from '../../../engine/camera/navigation-scales';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-scale-navigator',
  styleUrl: './scale-navigator.component.scss',
  templateUrl: './scale-navigator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaleNavigatorComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly menuOpen = signal(false);
  protected readonly navigationScales = NAVIGATION_SCALES;
  protected readonly breadcrumbItems = computed(() => {
    const targetId = this.facade.targetId();

    if (!targetId) {
      return [];
    }
    const objectsById = new Map(this.facade.objects().map((object) => [object.id, object]));
    const visited = new Set<string>();
    const items: Array<{ id: string; name: string }> = [];
    let currentId: string | undefined = targetId;

    while (currentId && !visited.has(currentId)) {
      const object = objectsById.get(currentId);

      if (!object) {
        break;
      }
      visited.add(currentId);
      items.unshift({ id: object.id, name: this.i18n.objectName(object.id, object.name) });
      currentId = object.parentId;
    }

    return items;
  });

  protected scaleLabel(): string {
    const lodLevel = this.facade.lodLevel();
    const scale = getNavigationScaleForLod(lodLevel);
    const defaultLabel = this.i18n.content().navigationScales[scale.id].label;
    const target = this.facade.objects().find((object) => object.id === this.facade.targetId());

    if (target?.type === 'black-hole') {
      return this.i18n.content().scale.blackHole;
    }

    if (lodLevel !== 3) {
      return defaultLabel;
    }

    return target?.type === 'galaxy' ? this.i18n.objectName(target.id, target.name) : defaultLabel;
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected viewScale(scale: NavigationScaleDefinition): void {
    this.menuOpen.set(false);
    this.facade.viewScale(scale);
  }

  protected navigateToObject(objectId: string): void {
    void this.facade.focus(objectId);
  }
}
