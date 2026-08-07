import { Injectable, signal } from '@angular/core';
import type { SpaceObject } from '../../../data/models/universe.models';

export type EarthSkyViewPhase = 'closed' | 'travelling' | 'open';

@Injectable({ providedIn: 'root' })
export class EarthSkyViewState {
  public readonly activeTargetId = signal<string | null>(null);
  public readonly activeTargetName = signal('');
  public readonly activeTarget = signal<SpaceObject | null>(null);
  public readonly entryPitchOffsetDegrees = signal(0);
  public readonly phase = signal<EarthSkyViewPhase>('closed');
  private journeyRevision = 0;

  public open(
    objectId: string,
    objectName = objectId,
    target: SpaceObject | null = null,
    entryPitchOffsetDegrees = 0,
  ): void {
    this.journeyRevision += 1;
    this.activeTargetId.set(objectId);
    this.activeTargetName.set(objectName);
    this.activeTarget.set(target);
    this.entryPitchOffsetDegrees.set(entryPitchOffsetDegrees);
    this.phase.set('open');
  }

  public beginJourney(
    objectId: string,
    objectName: string,
    target: SpaceObject | null = null,
    entryPitchOffsetDegrees = 0,
  ): number {
    this.journeyRevision += 1;
    this.activeTargetId.set(objectId);
    this.activeTargetName.set(objectName);
    this.activeTarget.set(target);
    this.entryPitchOffsetDegrees.set(entryPitchOffsetDegrees);
    this.phase.set('travelling');

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
    this.phase.set('closed');
  }
}
