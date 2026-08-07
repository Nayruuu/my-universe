import { TestBed } from '@angular/core/testing';
import type { SpaceObject } from '../../../data/models/universe.models';
import { EarthSkyViewState } from './earth-sky-view-state';

describe('EarthSkyViewState', () => {
  it('n’ouvre la vue terrestre que pour une cible demandée explicitement', () => {
    const state = TestBed.inject(EarthSkyViewState);

    expect(state.activeTargetId()).toBeNull();
    expect(state.activeTarget()).toBeNull();
    expect(state.phase()).toBe('closed');

    state.open('sirius', 'Sirius', null, 18);
    expect(state.activeTargetId()).toBe('sirius');
    expect(state.activeTargetName()).toBe('Sirius');
    expect(state.entryPitchOffsetDegrees()).toBe(18);
    expect(state.phase()).toBe('open');

    state.close();
    expect(state.activeTargetId()).toBeNull();
    expect(state.activeTarget()).toBeNull();
    expect(state.activeTargetName()).toBe('');
    expect(state.phase()).toBe('closed');
  });

  it('conserve la cible astronomique pendant toute la vue terrestre', () => {
    const state = TestBed.inject(EarthSkyViewState);
    const target = sirius();

    state.beginJourney(target.id, target.name, target, 72.1);

    expect(state.activeTarget()).toBe(target);
    expect(state.entryPitchOffsetDegrees()).toBe(72.1);
    state.completeJourney(1);
    expect(state.activeTarget()).toBe(target);
    expect(state.entryPitchOffsetDegrees()).toBe(72.1);

    state.close();
    expect(state.activeTarget()).toBeNull();
    expect(state.entryPitchOffsetDegrees()).toBe(0);
  });

  it('ignore la fin d’un ancien voyage après une nouvelle navigation', () => {
    const state = TestBed.inject(EarthSkyViewState);
    const firstJourney = state.beginJourney('sirius', 'Sirius');

    expect(state.phase()).toBe('travelling');
    expect(state.isCurrentJourney(firstJourney)).toBe(true);

    state.open('vega', 'Véga');

    expect(state.completeJourney(firstJourney)).toBe(false);
    expect(state.isCurrentJourney(firstJourney)).toBe(false);
    expect(state.activeTargetId()).toBe('vega');
    expect(state.phase()).toBe('open');
  });

  it('termine ou annule uniquement le voyage encore actif', () => {
    const state = TestBed.inject(EarthSkyViewState);
    const journey = state.beginJourney('sirius', 'Sirius');

    expect(state.completeJourney(journey)).toBe(true);
    expect(state.phase()).toBe('open');

    const cancelledJourney = state.beginJourney('vega', 'Véga');

    expect(state.cancelJourney(cancelledJourney + 1)).toBe(false);
    expect(state.cancelJourney(cancelledJourney)).toBe(true);
    expect(state.phase()).toBe('closed');
  });
});

function sirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      rightAscensionDegrees: 101.287_155,
      declinationDegrees: -16.716_116,
      skyCoordinateEpoch: 'J2000',
    },
  };
}
