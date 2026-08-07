import { inject, Injectable } from '@angular/core';
import type { SpaceObject } from '../../../data/models/universe.models';
import { EARTH_OBSERVER_JOURNEY_DURATION_SECONDS } from '../../../engine/camera/earth-observer-camera-control';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { EarthObserverSelection } from './earth-observer-selection';
import { earthSkyEntryFraming } from './earth-sky-entry-framing';
import { EarthSkyViewState } from './earth-sky-view-state';

const CHECK_INTERVAL_MILLISECONDS = 50;
const MINIMUM_JOURNEY_MILLISECONDS = EARTH_OBSERVER_JOURNEY_DURATION_SECONDS * 1_000;
const MAXIMUM_JOURNEY_MILLISECONDS = 2_800;

@Injectable({ providedIn: 'root' })
export class EarthSkyJourney {
  private readonly facade = inject(UniverseEngineFacade);
  private readonly observerSelection = inject(EarthObserverSelection);
  private readonly viewState = inject(EarthSkyViewState);

  public async start(object: SpaceObject): Promise<void> {
    const location = this.observerSelection.location();
    const framing = location
      ? earthSkyEntryFraming(object, this.facade.currentTime(), location)
      : null;
    const revision = this.viewState.beginJourney(
      object.id,
      object.name,
      object,
      framing?.initialPitchOffsetDegrees,
    );

    try {
      await this.facade.prepareEarthObservation(object.id, framing ?? undefined);
      await this.waitForArrival(revision);
    } catch {
      this.viewState.cancelJourney(revision);

      return;
    }
    if (!this.viewState.isCurrentJourney(revision)) {
      return;
    }
    this.facade.selectObject(object.id);
    this.facade.setTemporalMode('observable');
    this.viewState.completeJourney(revision);
  }

  public async retarget(object: SpaceObject): Promise<void> {
    const previousTargetId = this.viewState.activeTargetId();
    const previousTargetName = this.viewState.activeTargetName();
    const previousTarget = this.viewState.activeTarget();
    const previousPitchOffsetDegrees = this.viewState.entryPitchOffsetDegrees();
    const location = this.observerSelection.location();
    const framing = location
      ? earthSkyEntryFraming(object, this.facade.currentTime(), location)
      : null;

    this.viewState.open(object.id, object.name, object, framing?.initialPitchOffsetDegrees);
    try {
      await this.facade.prepareEarthObservation(object.id, framing ?? undefined);
    } catch {
      if (previousTargetId) {
        this.viewState.open(
          previousTargetId,
          previousTargetName,
          previousTarget,
          previousPitchOffsetDegrees,
        );
      } else {
        this.viewState.close();
      }

      return;
    }
    this.facade.setTemporalMode('observable');
  }

  private async waitForArrival(revision: number): Promise<void> {
    let elapsedMilliseconds = 0;

    while (
      this.viewState.isCurrentJourney(revision) &&
      elapsedMilliseconds < MAXIMUM_JOURNEY_MILLISECONDS &&
      (elapsedMilliseconds < MINIMUM_JOURNEY_MILLISECONDS || this.facade.isCameraTransitioning())
    ) {
      await delay(CHECK_INTERVAL_MILLISECONDS);
      elapsedMilliseconds += CHECK_INTERVAL_MILLISECONDS;
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
