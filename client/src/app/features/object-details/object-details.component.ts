import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { SpaceObject } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { ObjectDetailsPresenter } from './object-details.presenter';

@Component({
  selector: 'app-object-details',
  styleUrl: './object-details.component.scss',
  templateUrl: './object-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectDetailsComponent {
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly object = this.facade.selectedObject;
  protected readonly presenter = new ObjectDetailsPresenter({
    content: () => this.i18n.content(),
    language: () => this.i18n.lang(),
    objects: () => this.facade.objects(),
    formatNumber: (value, maximumFractionDigits) =>
      this.i18n.formatNumber(value, maximumFractionDigits),
    objectName: (objectId, fallback) => this.i18n.objectName(objectId, fallback),
    interpolate: (template, values) => this.i18n.interpolate(template, values),
  });

  protected focus(object: SpaceObject): void {
    void this.facade.focus(object.id);
  }

  protected viewRotation(object: SpaceObject): void {
    void this.facade.viewRotation(object.id);
  }

  protected viewOrbit(object: SpaceObject): void {
    this.facade.viewOrbit(object.id);
  }

  protected viewSupernovaEvent(object: SpaceObject): void {
    const julianDay = object.metadata?.['visualPeakJulianDay'];

    if (typeof julianDay !== 'number') {
      return;
    }
    this.facade.setTime({ julianDay });
    void this.facade.focus(object.id);
  }
}
