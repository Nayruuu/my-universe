import { inject, Injectable, signal } from '@angular/core';
import type { SpaceObject } from '../../../data/models/universe.models';
import { EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES } from '../../../engine/camera/earth-observer-view.constants';
import { NavigationPresentationState } from '../../core/url/navigation-presentation-state';

export type EarthSkyViewPhase = 'closed' | 'travelling' | 'open';

@Injectable({ providedIn: 'root' })
export class EarthSkyViewState {
  public readonly activeTargetId = signal<string | null>(null);
  public readonly activeTargetName = signal('');
  public readonly activeTarget = signal<SpaceObject | null>(null);
  public readonly entryPitchOffsetDegrees = signal(0);
  public readonly entryVerticalFieldOfViewDegrees = signal(EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES);
  public readonly phase = signal<EarthSkyViewPhase>('closed');

  private readonly navigation = inject(NavigationPresentationState);
  private journeyRevision = 0;

  public open(
    objectId: string,
    objectName = objectId,
    target: SpaceObject | null = null,
    entryPitchOffsetDegrees = 0,
    entryVerticalFieldOfViewDegrees = EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  ): void {
    this.journeyRevision += 1;
    this.activeTargetId.set(objectId);
    this.activeTargetName.set(objectName);
    this.activeTarget.set(target);
    this.entryPitchOffsetDegrees.set(entryPitchOffsetDegrees);
    this.entryVerticalFieldOfViewDegrees.set(entryVerticalFieldOfViewDegrees);
    this.phase.set('open');
    this.navigation.setViewMode('planetarium');
  }

  public beginJourney(
    objectId: string,
    objectName: string,
    target: SpaceObject | null = null,
    entryPitchOffsetDegrees = 0,
    entryVerticalFieldOfViewDegrees = EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  ): number {
    this.journeyRevision += 1;
    this.activeTargetId.set(objectId);
    this.activeTargetName.set(objectName);
    this.activeTarget.set(target);
    this.entryPitchOffsetDegrees.set(entryPitchOffsetDegrees);
    this.entryVerticalFieldOfViewDegrees.set(entryVerticalFieldOfViewDegrees);
    this.phase.set('travelling');
    this.navigation.setViewMode('planetarium');

    return this.journeyRevision;
  }

  public isCurrentJourney(revision: number): boolean {
    return this.journeyRevision === revision && this.phase() === 'travelling';
  }

  public completeJourney(revision: number): boolean {
    if (!this.isCurrentJourney(revision)) {
      return false;
    }
    this.phase.set('open');

    return true;
  }

  public cancelJourney(revision: number): boolean {
    if (!this.isCurrentJourney(revision)) {
      return false;
    }
    this.close();

    return true;
  }

  public close(): void {
    this.journeyRevision += 1;
    this.activeTargetId.set(null);
    this.activeTargetName.set('');
    this.activeTarget.set(null);
    this.entryPitchOffsetDegrees.set(0);
    this.entryVerticalFieldOfViewDegrees.set(EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES);
    this.phase.set('closed');
    this.navigation.setViewMode('map');
  }
}
