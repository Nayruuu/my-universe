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
    await this.travel(object, undefined);
  }

  public restore(object: SpaceObject, selectedObjectId: string | null): Promise<boolean> {
    return this.travel(object, selectedObjectId);
  }

  public async retargetById(
    objectId: string,
    preservedHorizonPercentage?: number,
  ): Promise<boolean> {
    const object = await this.facade.resolveObject(objectId);

    return object ? this.retarget(object, preservedHorizonPercentage) : false;
  }

  public async retarget(
    object: SpaceObject,
    preservedHorizonPercentage?: number,
  ): Promise<boolean> {
    const previousTargetId = this.viewState.activeTargetId();
    const previousTargetName = this.viewState.activeTargetName();
    const previousTarget = this.viewState.activeTarget();
    const previousPitchOffsetDegrees = this.viewState.entryPitchOffsetDegrees();
    const previousVerticalFieldOfViewDegrees = this.viewState.entryVerticalFieldOfViewDegrees();
    const location = this.observerSelection.location();
    const framing = location
      ? earthSkyEntryFraming(
          object,
          this.facade.currentTime(),
          location,
          preservedHorizonPercentage,
        )
      : null;

    this.viewState.open(
      object.id,
      object.name,
      object,
      framing?.initialPitchOffsetDegrees,
      framing?.verticalFieldOfViewDegrees,
    );
    try {
      await this.facade.prepareEarthObservation(object.id, framing ?? undefined);
    } catch {
      if (previousTargetId) {
        this.viewState.open(
          previousTargetId,
          previousTargetName,
          previousTarget,
          previousPitchOffsetDegrees,
          previousVerticalFieldOfViewDegrees,
        );
      } else {
        this.viewState.close();
      }

      return false;
    }
    this.facade.selectObject(object.id);
    this.facade.setTemporalMode('observable');

    return true;
  }

  private async travel(
    object: SpaceObject,
    selectedObjectId: string | null | undefined,
  ): Promise<boolean> {
    const location = this.observerSelection.location();

    this.observerSelection.synchronizeNavigation();
    const framing = location
      ? earthSkyEntryFraming(object, this.facade.currentTime(), location)
      : null;
    const revision = this.viewState.beginJourney(
      object.id,
      object.name,
      object,
      framing?.initialPitchOffsetDegrees,
      framing?.verticalFieldOfViewDegrees,
    );

    try {
      if (selectedObjectId === undefined) {
        await this.facade.prepareEarthObservation(object.id, framing ?? undefined);
      } else {
        await this.facade.prepareEarthObservation(
          object.id,
          framing ?? undefined,
          selectedObjectId,
        );
      }
      await this.waitForArrival(revision);
    } catch {
      this.viewState.cancelJourney(revision);

      return false;
    }
    if (!this.viewState.isCurrentJourney(revision)) {
      return false;
    }
    this.facade.selectObject(selectedObjectId === undefined ? object.id : selectedObjectId);
    this.facade.setTemporalMode('observable');
    this.viewState.completeJourney(revision);

    return true;
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
